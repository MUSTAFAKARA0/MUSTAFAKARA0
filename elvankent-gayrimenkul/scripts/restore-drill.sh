#!/usr/bin/env bash
# =============================================================================
# KARAY — geri yükleme tatbikatı. scripts/backup-db.sh ile alınmış bir yedeği AYRI ve GEÇİCİ bir
# veritabanına yükler, doğrular ve iş bitince (başarılı ya da başarısız) siler.
#
# Kullanım:
#   ADMIN_DB_URL=postgresql://kullanici@sunucu:5432/postgres bash scripts/restore-drill.sh <yedek-klasörü> <STAMP>
#
# ADMIN_DB_URL: CREATE DATABASE yetkisi olan YEREL / TEST sunucusu (adreste veritabanı adı bulunmalı).
#   Betik bu sunucuda yalnızca "karay_restore_drill_<zaman>" adlı YENİ bir veritabanı oluşturur; var olan
#   hiçbir veritabanına yazmaz. Production sunucusunda çalıştırmayın. Sunucuda Supabase rolleri (anon,
#   authenticated, service_role …) bulunmalıdır; yoksa yetkiler geri yüklenemez ve tatbikat başarısız olur.
#
# Adımlar (biri başarısız olursa durur; geçici veritabanı her durumda silinir):
#   1) sha256sum -c db-<STAMP>.sha256   — dump, parmak izi ve tablo sayıları bozulmamış
#   2) pg_restore --list                — dump okunabilir
#   3) CREATE DATABASE karay_restore_drill_<zaman>
#   4) pg_restore --no-owner --single-transaction — hata olursa yarım geri yükleme kalmaz
#   5) parmak izi (kritik tablolar: sayı + özet) yedektekiyle birebir aynı
#   6) yedekteki her tablonun satır sayısı birebir aynı
#   7) postflight_v2.sql: HATA satırı yok (RLS, yetkiler, güvenlik fonksiyonları)
#   8) geçici veritabanı silinir (KEEP_DB=1 ile inceleme için bırakılabilir; sonra elle silin)
#
# Çıktı yalnızca adım durumlarını ve satır eşleşme sayılarını yazar; kayıt içeriği veya sayısı yazmaz.
# =============================================================================
set -euo pipefail

DIR=${1:?Kullanım: restore-drill.sh <yedek-klasörü> <STAMP>}
STAMP=${2:?Kullanım: restore-drill.sh <yedek-klasörü> <STAMP>}
: "${ADMIN_DB_URL:?ADMIN_DB_URL tanımlı değil}"
if [[ ! "$ADMIN_DB_URL" =~ ^postgres(ql)?://[^/]+/[^?/]+ ]]; then
  echo "✗ ADMIN_DB_URL bir veritabanı adı içermeli (ör. …:5432/postgres)" >&2
  exit 1
fi
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OPS="$HERE/../supabase/ops"
NAME="db-$STAMP"
TMPDB="karay_restore_drill_$(date -u +%Y%m%d%H%M%S)_$$"
TARGET_URL=$(sed -E "s#^(postgres(ql)?://[^/]+)/[^?]*#\1/$TMPDB#" <<< "$ADMIN_DB_URL")
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
fail() { echo "✗ $1" >&2; exit 1; }

step "1/7 SHA-256 doğrulaması"
if command -v sha256sum > /dev/null; then SUM=(sha256sum -c --quiet); else SUM=(shasum -a 256 -c --quiet); fi
( cd "$DIR" && "${SUM[@]}" "$NAME.sha256" ) || fail "SHA-256 uyuşmuyor: yedek dosyaları bozuk veya eksik"

step "2/7 Dump okunabilirliği"
pg_restore --list "$DIR/$NAME.dump" > /dev/null || fail "Dump okunamıyor"

step "3/7 Geçici veritabanı: $TMPDB"
psql "$ADMIN_DB_URL" -X -q -v ON_ERROR_STOP=1 -c "create database \"$TMPDB\" template template0" > /dev/null || fail "Geçici veritabanı oluşturulamadı"
created=1

step "4/7 Geri yükleme (tek işlem)"
pg_restore --no-owner --single-transaction --exit-on-error --dbname "$TARGET_URL" "$DIR/$NAME.dump" 2> "$WORK/restore.err" \
  || { sed -E 's#postgres(ql)?://[^[:space:]"]+#<bağlantı>#g; s/(server at |host name |host |user |role |database )"[^"]*"/\1"<gizlendi>"/g' "$WORK/restore.err" | head -20 >&2; fail "Geri yükleme başarısız (hiçbir şey yarım kalmadı; geçici veritabanı silinecek)"; }

target() { psql "$TARGET_URL" -X -q -At -v ON_ERROR_STOP=1 -c 'set row_security = off' "$@"; }

step "5/7 Parmak izi karşılaştırması"
target -f "$OPS/backup_fingerprint.sql" > "$WORK/fingerprint.txt"
if ! diff -q "$DIR/$NAME.fingerprint.txt" "$WORK/fingerprint.txt" > /dev/null; then
  diff "$DIR/$NAME.fingerprint.txt" "$WORK/fingerprint.txt" | grep '^[<>]' | awk -F' \\| ' '{print "    fark: " $2}' | sort -u >&2
  fail "Parmak izi farklı"
fi
echo "    $(grep -c . "$WORK/fingerprint.txt") / $(grep -c . "$DIR/$NAME.fingerprint.txt") satır aynı"

step "6/7 Tablo satır sayıları"
target -f "$OPS/backup_table_counts.sql" > "$WORK/tables.all.txt"
# Yedekteki tablo listesine göre süz (yedeği alan rolün göremediği tablolar listede yoktur)
awk -F' \\| ' 'NR == FNR { want[$1] = 1; next } ($1 in want)' "$DIR/$NAME.tables.txt" "$WORK/tables.all.txt" > "$WORK/tables.txt"
if ! diff -q "$DIR/$NAME.tables.txt" "$WORK/tables.txt" > /dev/null; then
  diff "$DIR/$NAME.tables.txt" "$WORK/tables.txt" | grep '^[<>]' | awk -F' \\| ' '{print "    fark: " $1}' | sed 's/^    fark: [<>] /    fark: /' | sort -u >&2
  fail "Tablo satır sayıları farklı"
fi
echo "    $(grep -c . "$WORK/tables.txt") / $(grep -c . "$DIR/$NAME.tables.txt") tablo aynı"

step "7/7 Son kontrol (postflight_v2.sql)"
target -f "$OPS/postflight_v2.sql" > "$WORK/postflight.txt"
# durum sütunu: "TAMAM", "HATA" veya "HATA: <ayrıntı>" ya da "... ile KARŞILAŞTIRIN" (önek ile eşlenir)
errors=$(awk -F'|' '$4 ~ /^HATA/' "$WORK/postflight.txt" | wc -l)
if [ "$errors" -ne 0 ]; then
  awk -F'|' '$4 ~ /^HATA/ { print "    " $1 ") " $2 ": " $4 }' "$WORK/postflight.txt" >&2
  fail "Son kontrolde $errors HATA"
fi
echo "    $(awk -F'|' '$4 == "TAMAM"' "$WORK/postflight.txt" | wc -l) TAMAM, $(awk -F'|' '$4 ~ /KARŞILAŞTIR/' "$WORK/postflight.txt" | wc -l) karşılaştırılacak satır, 0 HATA"

echo "✓ Geri yükleme tatbikatı başarılı: $NAME"
