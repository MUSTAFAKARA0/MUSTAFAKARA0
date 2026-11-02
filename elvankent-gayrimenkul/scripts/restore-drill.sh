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
#      8) postflight_v2.sql: "…uygulanmamış" / "şema sürümü eski" satırları, şema geride (sürüm eski YA DA sürüm
#         fonksiyonu hiç yok — canlıdaki durum) ve eksikler tutarlıysa (denetlenen migration'ların son kısmı) BİLGİ;
#         tutarsız eksikler ve diğer tüm HATA satırları (RLS, yetki, istemciye açık fonksiyon …) → ŞEMA: HATA, çıkış 3
#      9) KI-23 şema ve güvenlik denetimi (supabase/ops/canli_sema_denetimi.sql): yalnız yedeğin migration geçmişi canlının
#         bilinen durumundaysa (son kayıt 20261001000001 = denetimin başvurusu). G (mutlak güvenlik kuralı) HATA → ŞEMA: HATA,
#         çıkış 3; P (parmak izi) AYNI olmayan nesne sayısı bilgi olarak yazılır (DENETIM_P=…), nesne adları da yazılır.
#         Ardından canli_fonksiyon_teshis.sql: DENETIM_FONKSIYON=AYNI / BICIM (fark yalnız satır sonu) / ACIKLANAMAZ.
#         Başka durumda ATLANDI. (xmin geri yüklemede korunmaz: köken sorgusu yedekte anlamsızdır, burada çalıştırılmaz.)
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

step "1/9 SHA-256 doğrulaması"
if command -v sha256sum > /dev/null; then SUM=(sha256sum -c --quiet); else SUM=(shasum -a 256 -c --quiet); fi
( cd "$DIR" && "${SUM[@]}" "$NAME.sha256" ) || fail "SHA-256 uyuşmuyor: yedek dosyaları bozuk veya eksik"

step "2/9 Dump okunabilirliği"
pg_restore --list "$DIR/$NAME.dump" > /dev/null || fail "Dump okunamıyor"

step "3/9 Geçici veritabanı: $TMPDB"
psql "$ADMIN_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "create database \"$TMPDB\" template template0" > /dev/null || fail "Geçici veritabanı oluşturulamadı"
created=1

step "4/9 Geri yükleme (tek işlem)"
pg_restore --no-owner --single-transaction --exit-on-error --dbname "$TARGET_URL" "$DIR/$NAME.dump" 2> "$WORK/restore.err" \
  || { sed -E 's#postgres(ql)?://[^[:space:]"]+#<bağlantı>#g; s/(server at |host name |host |user |role |database )"[^"]*"/\1"<gizlendi>"/g' "$WORK/restore.err" | head -20 >&2; fail "Geri yükleme başarısız (hiçbir şey yarım kalmadı; geçici veritabanı silinecek)"; }

target() { psql "$TARGET_URL" -X -q -At -v ON_ERROR_STOP=1 -c 'set row_security = off' "$@"; }

step "5/9 Parmak izi karşılaştırması"
target -f "$OPS/backup_fingerprint.sql" > "$WORK/fingerprint.txt"
if ! diff -q "$DIR/$NAME.fingerprint.txt" "$WORK/fingerprint.txt" > /dev/null; then
  diff "$DIR/$NAME.fingerprint.txt" "$WORK/fingerprint.txt" | grep '^[<>]' | awk -F' \\| ' '{print "    fark: " $2}' | sort -u >&2 || true
  fail "Parmak izi farklı"
fi
echo "    $(grep -c . "$WORK/fingerprint.txt") / $(grep -c . "$DIR/$NAME.fingerprint.txt") satır aynı"

step "6/9 Tablo satır sayıları"
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
step "7/9 Şema sürümü"
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

step "8/9 Son kontrol (postflight_v2.sql)"
target -f "$OPS/postflight_v2.sql" > "$WORK/postflight.txt"
# durum sütunu: "TAMAM", "HATA" veya "HATA: <ayrıntı>" ya da "... ile KARŞILAŞTIRIN" (önek ile eşlenir)
errors=$(awk -F'|' '$4 ~ /^HATA/' "$WORK/postflight.txt" | wc -l)
# Migration gecikmesi adayları: "HATA: <id>_<ad>.sql uygulanmamış" ve "HATA: şema sürümü eski". Yalnız şema GERİDE
# (sürüm eski ya da sürüm fonksiyonu hiç yok) ve eksikler TUTARLI ise bilgi sayılır:
#   - eksik migration'lar, postflight'ın denetlediği migration'ların SON KISMI olmalı (ilk eksikten sonraki hepsi eksik).
#     Arada bir eksik, sonrası uygulanmış görünüyorsa (ör. açık bir politika "…uygulanmamış" yazdırıyorsa) → HATA.
#   - sürüm okunabiliyorsa, ilk eksik migration sürümden yeni olmalı.
# RLS, yetki, istemciye açık fonksiyon ve diğer tüm HATA satırları hiçbir durumda bilgiye çevrilmez.
CAND_RE='(^HATA: [0-9]{14}_[a-z0-9_]+\.sql uygulanmamış$|^HATA: şema sürümü eski$)'
grep -oE '[0-9]{14}_[a-z0-9_]+\.sql uygulanmamış' "$OPS/postflight_v2.sql" | cut -c1-14 | sort -u > "$WORK/checked.txt"
awk -F'|' -v re="$CAND_RE" '$4 ~ re { print $4 }' "$WORK/postflight.txt" | grep -oE '[0-9]{14}' | sort -u > "$WORK/missing.txt" || true
cand=$(awk -F'|' -v re="$CAND_RE" '$4 ~ re' "$WORK/postflight.txt" | wc -l)
FIRST_MISSING=$(head -1 "$WORK/missing.txt")
gap_ok=0; gap_why=""
if [ "$cand" -gt 0 ]; then
  if [ "$sema" != BILGI ] || { [ -n "$VERSION" ] && [[ ! "$VERSION" < "$LATEST" ]]; }; then
    gap_why="şema sürümü güncel ya da ileride: eksik migration beklenmez"
  elif [ -n "$FIRST_MISSING" ] && ! diff -q "$WORK/missing.txt" <(awk -v f="$FIRST_MISSING" '$1 >= f' "$WORK/checked.txt") > /dev/null; then
    gap_why="eksikler tutarsız: $FIRST_MISSING eksik görünüyor ama sonraki migration'lardan en az biri uygulanmış (RLS/yetki açığı olabilir)"
  elif [ -n "$FIRST_MISSING" ] && [ -n "$VERSION" ] && [[ ! "$VERSION" < "$FIRST_MISSING" ]]; then
    gap_why="eksikler tutarsız: şema sürümü $VERSION, $FIRST_MISSING uygulanmış olmalıydı"
  elif [ -z "$VERSION" ] && grep -q 'şema sürümü eski' <(awk -F'|' '$4 ~ /^HATA/ { print $4 }' "$WORK/postflight.txt"); then
    gap_why="sürüm fonksiyonu yokken \"şema sürümü eski\" satırı beklenmez"
  else
    gap_ok=1
  fi
fi
gap=0
if [ "$gap_ok" = 1 ]; then gap=$cand; fi
real=$((errors - gap))
if [ -z "$VERSION" ] && [ -n "$FIRST_MISSING" ] && [ "$gap_ok" = 1 ]; then
  sema_not="şema sürümü fonksiyonu yok; son kontrole göre ilk eksik migration $FIRST_MISSING, sonraki $(($(wc -l < "$WORK/missing.txt") - 1)) denetlenen migration da eksik: canlıda henüz uygulanmamış — başarısızlık değil"
  result "SEMA_ILK_EKSIK=$FIRST_MISSING"
elif [ -n "$FIRST_MISSING" ] && [ "$gap_ok" = 1 ]; then
  result "SEMA_ILK_EKSIK=$FIRST_MISSING"
fi
if [ "$gap" -ne 0 ]; then
  echo "    $gap satır migration gecikmesi (şema geride, eksikler tutarlı) — bilgi:"
  awk -F'|' -v re="$CAND_RE" '$4 ~ re { print "      " $1 ") " $2 }' "$WORK/postflight.txt"
fi
if [ "$real" -ne 0 ]; then
  if [ "$gap_ok" = 1 ]; then
    awk -F'|' -v re="$CAND_RE" '$4 ~ /^HATA/ && $4 !~ re { print "    " $1 ") " $2 ": " $4 }' "$WORK/postflight.txt" >&2
  else
    awk -F'|' '$4 ~ /^HATA/ { print "    " $1 ") " $2 ": " $4 }' "$WORK/postflight.txt" >&2
    if [ -n "$gap_why" ]; then echo "    \"uygulanmamış\" satırları bilgi sayılmadı: $gap_why" >&2; fi
  fi
  echo "ŞEMA: HATA — son kontrolde $real güvenlik/şema HATA'sı (RLS, yetki, istemciye açık fonksiyon, tutarsız şema …)"
  result SEMA=HATA
  echo "✗ Geri yükleme tatbikatı: bütünlük TAMAM, şema uygunluğu HATA: $NAME" >&2
  exit 3
fi
echo "    $(awk -F'|' '$4 == "TAMAM"' "$WORK/postflight.txt" | wc -l) TAMAM, $(awk -F'|' '$4 ~ /KARŞILAŞTIR/' "$WORK/postflight.txt" | wc -l) karşılaştırılacak satır, $gap gecikme, 0 HATA"

step "9/9 KI-23 şema ve güvenlik denetimi (canli_sema_denetimi.sql)"
REG_LAST=$(target -c "select case when to_regclass('supabase_migrations.schema_migrations') is null then '' else (select coalesce(max(version), '') from supabase_migrations.schema_migrations) end" | tail -1)
if [ "$REG_LAST" = 20261001000001 ] && [ -f "$OPS/canli_sema_denetimi.sql" ]; then
  # Tanımlar oturumun search_path'ine göre yazılır (auth yoldaysa "auth.users" → "users"): SQL Editor'ün (postgres rolü) yolu
  target -F'|' -c 'set search_path = "$user", public, extensions' -f "$OPS/canli_sema_denetimi.sql" > "$WORK/denetim.txt"
  g_errors=$(awk -F'|' '$1 ~ /^G[0-9]/' "$WORK/denetim.txt" | wc -l)
  p_diff=$(awk -F'|' '$1 ~ /^P /' "$WORK/denetim.txt" | wc -l)
  awk -F'|' '$1 == "ÖZET" { print "    " $2 ": " $3 }' "$WORK/denetim.txt"
  if [ "$p_diff" -ne 0 ]; then awk -F'|' '$1 ~ /^P / { print "      " $1 " " $2 ": " $3 }' "$WORK/denetim.txt"; fi
  result "DENETIM_G=$([ "$g_errors" = 0 ] && echo TAMAM || echo HATA)"
  result "DENETIM_P=$([ "$p_diff" = 0 ] && echo AYNI || echo "FARKLI_$p_diff")"
  # Fonksiyon farkı teşhisi (canli_fonksiyon_teshis.sql): başlık / gövde / satır sonu (CR) — yalnız sayılar
  if [ -f "$OPS/canli_fonksiyon_teshis.sql" ]; then
    target -F'|' -c 'set search_path = "$user", public, extensions' -f "$OPS/canli_fonksiyon_teshis.sql" > "$WORK/teshis.txt"
    tv() { awk -F'|' -v k="$1" '$1 == "TESHIS" && $2 == k { print $3 }' "$WORK/teshis.txt"; }
    tb=$(tv 'beklenen fonksiyon'); tes=$(tv 'eşleşen imza'); tba=$(tv 'başlık AYNI'); tha=$(tv 'gövde ham AYNI'); tcr=$(tv 'gövde CR çıkarılınca AYNI'); tfz=$(tv 'beklenmeyen fonksiyon')
    echo "    fonksiyon teşhisi: başlık AYNI=$tba/$tb, gövde ham AYNI=$tha, CR çıkarılınca AYNI=$tcr, beklenmeyen=$tfz"
    if [ "$tes" = "$tb" ] && [ "$tba" = "$tb" ] && [ "$tcr" = "$tb" ] && [ "$tfz" = 0 ]; then
      result "DENETIM_FONKSIYON=$([ "$tha" = "$tb" ] && echo AYNI || echo BICIM)"
    else
      result DENETIM_FONKSIYON=ACIKLANAMAZ
    fi
  fi
  if [ "$g_errors" -ne 0 ]; then
    awk -F'|' '$1 ~ /^G[0-9]/ { print "    " $1 " " $2 ": " $3 }' "$WORK/denetim.txt" >&2
    echo "ŞEMA: HATA — KI-23 denetiminde $g_errors mutlak güvenlik kuralı ihlali"
    result SEMA=HATA
    echo "✗ Geri yükleme tatbikatı: bütünlük TAMAM, şema uygunluğu HATA: $NAME" >&2
    exit 3
  fi
else
  echo "    ATLANDI (yedeğin son geçmiş kaydı ${REG_LAST:-yok}; denetimin başvurusu 20261001000001)"
  result DENETIM=ATLANDI
fi

if [ "$sema" = TAMAM ]; then
  echo "ŞEMA: TAMAM — $sema_not"
else
  echo "ŞEMA: BİLGİ — $sema_not"
fi
result "SEMA=$sema"

echo "✓ Geri yükleme tatbikatı başarılı: $NAME (bütünlük TAMAM, şema $sema)"
