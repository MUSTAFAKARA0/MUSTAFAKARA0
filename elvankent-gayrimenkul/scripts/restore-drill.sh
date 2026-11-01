#!/usr/bin/env bash
# =============================================================================
# KARAY — geri yükleme tatbikatı. scripts/backup-db.sh ile alınmış bir yedeği AYRI ve GEÇİCİ bir
# veritabanına yükler, doğrular ve iş bitince (başarılı ya da başarısız) siler.
#
# Kullanım:
#   ADMIN_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash scripts/restore-drill.sh <yedek-klasörü> <STAMP>
#   (isteğe bağlı) DRILL_RESULT=<dosya> → BUTUNLUK=…, SEMA=…, SEMA_SURUM=… satırları yazılır (CI / iş akışı için)
#
# YALITIM (KI-24 şartı: geri yükleme YALNIZ izole yerel test veritabanına):
#   - ADMIN_DB_URL yalnız postgres(ql)://[kullanıcı[:parola]@](127.0.0.1|localhost|[::1])[:port]/<veritabanı> biçiminde olabilir;
#     sorgu parametresi (?host=, ?hostaddr=, ?service= …), birden çok ana makine, uzak ad/adres, anahtar=değer biçimi reddedilir.
#   - "localhost" yalnız loopback adreslerine çözülüyorsa kabul edilir.
#   - Hedefi değiştirebilen PGHOSTADDR / PGSERVICE / PGSERVICEFILE ortam değişkenleri tanımlıysa durur.
#   Bu denetimler HİÇBİR veritabanı aracı çağrılmadan yapılır (çıkış 2). Bağlandıktan sonra sunucu kendini genel ağ
#   adresiyle görüyorsa (loopback / özel ağ / Docker köprüsü / soket değil) veritabanı oluşturulmadan durur (çıkış 2).
#   Betik yalnızca "karay_restore_drill_<zaman>" adlı YENİ bir veritabanı oluşturur; var olan hiçbir veritabanına yazmaz.
#   Sunucuda Supabase rolleri (anon, authenticated, service_role …) bulunmalıdır (yerel `supabase start` sağlar).
#
# İKİ AYRI KONTROL (KI-24 şartı: canlıda henüz uygulanmamış migration'lar bütünlük hatası sayılmaz):
#   A) BÜTÜNLÜK — yedek sağlam mı, eksiksiz geri yükleniyor mu?            başarısız → çıkış 1
#      1) sha256sum -c db-<STAMP>.sha256   2) pg_restore --list   3) CREATE DATABASE karay_restore_drill_<zaman>
#      4) pg_restore --no-owner --single-transaction   5) parmak izi birebir   6) her tablonun satır sayısı birebir
#   B) ŞEMA UYGUNLUĞU — geri yüklenen şema depodaki güncel şemayla ve güvenlik kurallarıyla uyumlu mu?
#      7) karay_schema_version() ↔ supabase/migrations'taki son migration: aynı → TAMAM; geride/ileride → BİLGİ
#         supabase/pending dosyaları canlıda uygulanmamış olabilir: yalnız bilgi, uygunluk ölçütü değil
#      8) postflight_v2.sql: "…uygulanmamış" / "şema sürümü eski" satırları, şema geride ise BİLGİ (migration gecikmesi);
#         diğer HATA satırları (RLS, yetki, istemciye açık fonksiyon …) → ŞEMA: HATA, çıkış 3
#   Geçici veritabanı her durumda silinir (KEEP_DB=1 ile inceleme için bırakılabilir; sonra elle silin).
#
# Çıktı yalnızca adım durumlarını ve satır eşleşme sayılarını yazar; kayıt içeriği veya sayısı, bağlantı adresi yazmaz.
# =============================================================================
set -euo pipefail

DIR=${1:?Kullanım: restore-drill.sh <yedek-klasörü> <STAMP>}
STAMP=${2:?Kullanım: restore-drill.sh <yedek-klasörü> <STAMP>}
: "${ADMIN_DB_URL:?ADMIN_DB_URL tanımlı değil}"
yalitim() { echo "✗ YALITIM: $1 — geri yükleme yalnız izole yerel test veritabanına yapılır; hiçbir şey yapılmadı" >&2; exit 2; }
for v in PGHOSTADDR PGSERVICE PGSERVICEFILE; do
  [ -z "${!v:-}" ] || yalitim "$v ortam değişkeni tanımlı (bağlantı hedefini değiştirebilir)"
done
LOCAL_URL_RE='^postgres(ql)?://([^@/?#]*@)?(127\.0\.0\.1|localhost|\[::1\])(:[0-9]{1,5})?/[A-Za-z0-9_]+$'
[[ "$ADMIN_DB_URL" =~ $LOCAL_URL_RE ]] \
  || yalitim "ADMIN_DB_URL yerel test sunucusu değil (yalnız 127.0.0.1 / localhost / [::1] + veritabanı adı; sorgu parametresi yok)"
if [ "${BASH_REMATCH[3]}" = localhost ] && command -v getent > /dev/null; then
  while read -r addr _; do
    [[ "$addr" =~ ^(127\.|::1$) ]] || yalitim "localhost loopback dışı bir adrese çözülüyor"
  done < <(getent ahosts localhost)
fi
# Bağlantı sonrası: sunucu kendini nasıl görüyor? Loopback, özel ağ (yerel Docker köprüsü), bağlantı yerel ya da soket olmalı
SERVER_ADDR=$(psql "$ADMIN_DB_URL" -X -q -At -v ON_ERROR_STOP=1 -c "select coalesce(host(inet_server_addr()), '')") \
  || { echo "✗ Yerel test sunucusuna bağlanılamadı" >&2; exit 1; }
SERVER_ADDR=$(tr 'A-F' 'a-f' <<< "$SERVER_ADDR")
[[ -z "$SERVER_ADDR" || "$SERVER_ADDR" =~ ^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1$|f[cd][0-9a-f]{2}:|fe80:) ]] \
  || yalitim "sunucu kendini genel ağ adresiyle görüyor (loopback / özel ağ / soket değil)"

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OPS="$HERE/../supabase/ops"
NAME="db-$STAMP"
TMPDB="karay_restore_drill_$(date -u +%Y%m%d%H%M%S)_$$"
TARGET_URL=$(sed -E "s#^(postgres(ql)?://[^/]+)/.*#\1/$TMPDB#" <<< "$ADMIN_DB_URL")
LATEST=$(find "$HERE/../supabase/migrations" -maxdepth 1 -name '[0-9]*_*.sql' -exec basename {} \; | sort | tail -1 | cut -c1-14)
PENDING=$(find "$HERE/../supabase/pending" -maxdepth 1 -name '*.sql' 2> /dev/null | wc -l | tr -d ' ')
WORK=$(mktemp -d)
created=0

cleanup() {
  local code=$?
  if [ "$created" = 1 ]; then
    if [ "${KEEP_DB:-0}" = 1 ]; then
      echo "  Geçici veritabanı bırakıldı (KEEP_DB=1): $TMPDB — inceledikten sonra silin: drop database \"$TMPDB\" with (force);"
    elif psql "$ADMIN_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$TMPDB\" with (force)" > /dev/null 2>&1; then
      echo "  Geçici veritabanı silindi: $TMPDB"
    else
      echo "✗ Geçici veritabanı SİLİNEMEDİ: $TMPDB — elle silin: drop database \"$TMPDB\" with (force);" >&2
      code=1
    fi
  fi
  rm -rf "$WORK"
  exit "$code"
}
trap cleanup EXIT
step() { echo "• $1"; }
result() { if [ -n "${DRILL_RESULT:-}" ]; then echo "$1" >> "$DRILL_RESULT"; fi; }
if [ -n "${DRILL_RESULT:-}" ]; then : > "$DRILL_RESULT"; fi
# Bütünlük hatası: şema değerlendirilmez
fail() { echo "✗ $1" >&2; echo "BÜTÜNLÜK: HATA — $1"; result BUTUNLUK=HATA; exit 1; }

echo "A) BÜTÜNLÜK"

step "1/8 SHA-256 doğrulaması"
if command -v sha256sum > /dev/null; then SUM=(sha256sum -c --quiet); else SUM=(shasum -a 256 -c --quiet); fi
( cd "$DIR" && "${SUM[@]}" "$NAME.sha256" ) || fail "SHA-256 uyuşmuyor: yedek dosyaları bozuk veya eksik"

step "2/8 Dump okunabilirliği"
pg_restore --list "$DIR/$NAME.dump" > /dev/null || fail "Dump okunamıyor"

step "3/8 Geçici veritabanı: $TMPDB"
psql "$ADMIN_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "create database \"$TMPDB\" template template0" > /dev/null || fail "Geçici veritabanı oluşturulamadı"
created=1

step "4/8 Geri yükleme (tek işlem)"
pg_restore --no-owner --single-transaction --exit-on-error --dbname "$TARGET_URL" "$DIR/$NAME.dump" 2> "$WORK/restore.err" \
  || { sed -E 's#postgres(ql)?://[^[:space:]"]+#<bağlantı>#g; s/(server at |host name |host |user |role |database )"[^"]*"/\1"<gizlendi>"/g' "$WORK/restore.err" | head -20 >&2; fail "Geri yükleme başarısız (hiçbir şey yarım kalmadı; geçici veritabanı silinecek)"; }

target() { psql "$TARGET_URL" -X -q -At -v ON_ERROR_STOP=1 -c 'set row_security = off' "$@"; }

step "5/8 Parmak izi karşılaştırması"
target -f "$OPS/backup_fingerprint.sql" > "$WORK/fingerprint.txt"
if ! diff -q "$DIR/$NAME.fingerprint.txt" "$WORK/fingerprint.txt" > /dev/null; then
  diff "$DIR/$NAME.fingerprint.txt" "$WORK/fingerprint.txt" | grep '^[<>]' | awk -F' \\| ' '{print "    fark: " $2}' | sort -u >&2 || true
  fail "Parmak izi farklı"
fi
echo "    $(grep -c . "$WORK/fingerprint.txt") / $(grep -c . "$DIR/$NAME.fingerprint.txt") satır aynı"

step "6/8 Tablo satır sayıları"
target -f "$OPS/backup_table_counts.sql" > "$WORK/tables.all.txt"
# Yedekteki tablo listesine göre süz (yedeği alan rolün göremediği tablolar listede yoktur)
awk -F' \\| ' 'NR == FNR { want[$1] = 1; next } ($1 in want)' "$DIR/$NAME.tables.txt" "$WORK/tables.all.txt" > "$WORK/tables.txt"
if ! diff -q "$DIR/$NAME.tables.txt" "$WORK/tables.txt" > /dev/null; then
  diff "$DIR/$NAME.tables.txt" "$WORK/tables.txt" | grep '^[<>]' | awk -F' \\| ' '{print "    fark: " $1}' | sed 's/^    fark: [<>] /    fark: /' | sort -u >&2 || true
  fail "Tablo satır sayıları farklı"
fi
echo "    $(grep -c . "$WORK/tables.txt") / $(grep -c . "$DIR/$NAME.tables.txt") tablo aynı"

echo "BÜTÜNLÜK: TAMAM — yedek sağlam ve eksiksiz geri yüklendi"
result BUTUNLUK=TAMAM

echo "B) ŞEMA UYGUNLUĞU (bütünlükten ayrı)"
step "7/8 Şema sürümü"
VERSION=$(target -c 'select public.karay_schema_version()' 2> /dev/null | tail -1) || VERSION=""
[[ "$VERSION" =~ ^[0-9]{14}$ ]] || VERSION=""
result "SEMA_SURUM=${VERSION:-yok}"
if [ -z "$VERSION" ]; then
  sema=BILGI; sema_not="şema sürümü okunamadı (karay_schema_version yok)"
elif [ "$VERSION" = "$LATEST" ]; then
  sema=TAMAM; sema_not="depodaki son migration ile aynı ($LATEST)"
elif [[ "$VERSION" < "$LATEST" ]]; then
  sema=BILGI; sema_not="yedeğin şeması depodaki son migration'dan geride ($VERSION < $LATEST): canlıda henüz uygulanmamış migration — başarısızlık değil"
else
  sema=BILGI; sema_not="yedeğin şeması depodan ileride ($VERSION > $LATEST): depo güncel değil"
fi
echo "    $sema_not"
echo "    $PENDING bekleyen dosya (supabase/pending) canlıda henüz uygulanmamış olabilir — bilgi, uygunluk ölçütü değil"

step "8/8 Son kontrol (postflight_v2.sql)"
target -f "$OPS/postflight_v2.sql" > "$WORK/postflight.txt"
# durum sütunu: "TAMAM", "HATA" veya "HATA: <ayrıntı>" ya da "... ile KARŞILAŞTIRIN" (önek ile eşlenir)
errors=$(awk -F'|' '$4 ~ /^HATA/' "$WORK/postflight.txt" | wc -l)
# Migration gecikmesi satırları: şema geride ise bilgi (canlıda uygulanmamış migration); aynıysa gerçek hata
gap=0
if [ "$sema" = BILGI ] && [ -n "$VERSION" ]; then
  gap=$(awk -F'|' '$4 ~ /^HATA/ && $4 ~ /(uygulanmamış|şema sürümü eski)/' "$WORK/postflight.txt" | wc -l)
fi
real=$((errors - gap))
if [ "$gap" -ne 0 ]; then
  echo "    $gap satır migration gecikmesi (şema sürümü geride) — bilgi:"
  awk -F'|' '$4 ~ /^HATA/ && $4 ~ /(uygulanmamış|şema sürümü eski)/ { print "      " $1 ") " $2 }' "$WORK/postflight.txt"
fi
if [ "$real" -ne 0 ]; then
  awk -F'|' '$4 ~ /^HATA/ && $4 !~ /(uygulanmamış|şema sürümü eski)/ { print "    " $1 ") " $2 ": " $4 }' "$WORK/postflight.txt" >&2
  echo "ŞEMA: HATA — son kontrolde $real güvenlik/şema HATA'sı (RLS, yetki, istemciye açık fonksiyon …)"
  result SEMA=HATA
  echo "✗ Geri yükleme tatbikatı: bütünlük TAMAM, şema uygunluğu HATA: $NAME" >&2
  exit 3
fi
echo "    $(awk -F'|' '$4 == "TAMAM"' "$WORK/postflight.txt" | wc -l) TAMAM, $(awk -F'|' '$4 ~ /KARŞILAŞTIR/' "$WORK/postflight.txt" | wc -l) karşılaştırılacak satır, $gap gecikme, 0 HATA"
if [ "$sema" = TAMAM ]; then
  echo "ŞEMA: TAMAM — $sema_not"
else
  echo "ŞEMA: BİLGİ — $sema_not"
fi
result "SEMA=$sema"

echo "✓ Geri yükleme tatbikatı başarılı: $NAME (bütünlük TAMAM, şema $sema)"
