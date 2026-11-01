#!/usr/bin/env bash
# =============================================================================
# KARAY — KI-24 sentetik "kuru prova": MÜŞTERİ VERİSİ YOK. Yerel test veritabanındaki demo verisinin yedeği
# (scripts/backup-db.sh) alınır ve scripts/restore-drill.sh ile yine YEREL geçici veritabanlarına geri yüklenir.
# CI (elvankent-ci › database) ve yerel çalıştırma aynı betiği kullanır.
#
# Kullanım (yalnız yerel `supabase start` yığını):
#   DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
#   DRILL_URL=postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres bash scripts/restore-drill-synthetic.sh
#
#   DB_URL     yedeğin alınacağı yerel veritabanı (uygulamanın rolü; canlıdaki yedek iş akışıyla aynı yetki)
#   DRILL_URL  yerel yığının süper kullanıcısı. Tam Supabase dump'ı (realtime şeması: "SET log_min_messages") yalnız
#              süper kullanıcıyla geri yüklenebilir; yerel `postgres` rolüyle 4. adım "permission denied" verir (K-23).
#
# Senaryolar (hepsi beklenen sonucu vermezse çıkış 1):
#   A  güncel şema              → BÜTÜNLÜK TAMAM, ŞEMA TAMAM, çıkış 0
#   B  canlı gibi geride şema   → BÜTÜNLÜK TAMAM, ŞEMA BİLGİ, çıkış 0 (son migration uygulanmamış: başarısızlık DEĞİL)
#      (A yedeği geçici bir veritabanına yüklenir; orada karay_schema_version() bir önceki sürüme çekilir ve
#       20261018000001'in sütun varsayılanı geri alınır; o veritabanının yedeği alınıp tatbikat yapılır)
#   C1 bozuk dump               → BÜTÜNLÜK HATA, çıkış 1, veritabanı oluşturulmaz
#   C2 uzak hedef (ADMIN_DB_URL) → YALITIM, çıkış 2 (hiçbir araç çağrılmadan)
# Geçici veritabanları ve dosyalar her durumda silinir.
# =============================================================================
set -euo pipefail

: "${DB_URL:?DB_URL tanımlı değil}"
: "${DRILL_URL:?DRILL_URL tanımlı değil}"
LOCAL_URL_RE='^postgres(ql)?://([^@/?#]*@)?(127\.0\.0\.1|localhost|\[::1\])(:[0-9]{1,5})?/[A-Za-z0-9_]+$'
for u in DB_URL DRILL_URL; do
  [[ "${!u}" =~ $LOCAL_URL_RE ]] || { echo "✗ YALITIM: $u yerel test sunucusu değil — sentetik prova yalnız yerelde çalışır" >&2; exit 2; }
done
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WORK=$(mktemp -d)
OLD_DB="karay_kuru_eski_$$"
OLD_URL=$(sed -E "s#^(postgres(ql)?://[^/]+)/.*#\1/$OLD_DB#" <<< "$DRILL_URL")
cleanup() {
  local code=$?
  psql "$DRILL_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$OLD_DB\" with (force)" > /dev/null 2>&1 || true
  rm -rf "$WORK"
  exit "$code"
}
trap cleanup EXIT
basarisiz=0
check() { # ad, beklenen çıkış, gerçek çıkış, sonuç dosyası, beklenen satırlar...
  local name=$1 want=$2 got=$3 res=$4; shift 4
  local ok=1
  [ "$got" = "$want" ] || ok=0
  for line in "$@"; do grep -qx "$line" "$res" 2> /dev/null || ok=0; done
  if [ "$ok" = 1 ]; then echo "  ✓ $name (çıkış $got${*:+, $*})"; else echo "  ✗ $name: çıkış $got (beklenen $want), sonuç: $(tr '\n' ' ' < "$res" 2> /dev/null)" >&2; basarisiz=1; fi
}
drill() { # klasör, stamp, sonuç dosyası → çıkış kodu
  local code=0
  ADMIN_DB_URL="$DRILL_URL" DRILL_RESULT="$3" bash "$HERE/restore-drill.sh" "$1" "$2" || code=$?
  return "$code"
}

echo "== A: güncel şema (demo verisi) =="
mkdir -p "$WORK/a"
SUPABASE_DB_URL="$DB_URL" OUT_DIR="$WORK/a" STAMP=kuru-a bash "$HERE/backup-db.sh"
code=0; drill "$WORK/a" kuru-a "$WORK/a.sonuc" || code=$?
check "A güncel şema" 0 "$code" "$WORK/a.sonuc" 'BUTUNLUK=TAMAM' 'SEMA=TAMAM'
grep -qx 'BUTUNLUK=TAMAM' "$WORK/a.sonuc" || { echo "✗ A bütünlüğü sağlanamadı; diğer senaryolar anlamsız" >&2; exit 1; }

echo "== B: canlı gibi geride kalmış şema (son migration uygulanmamış) =="
psql "$DRILL_URL" -X -q -v ON_ERROR_STOP=1 -c "create database \"$OLD_DB\" template template0" > /dev/null
pg_restore --no-owner --single-transaction --exit-on-error --dbname "$OLD_URL" "$WORK/a/db-kuru-a.dump"
PREV=$(find "$HERE/../supabase/migrations" -maxdepth 1 -name '[0-9]*_*.sql' -exec basename {} \; | sort | tail -2 | head -1 | cut -c1-14)
psql "$OLD_URL" -X -q -v ON_ERROR_STOP=1 <<SQL > /dev/null
create or replace function public.karay_schema_version() returns text language sql immutable set search_path = '' as \$\$ select '$PREV'::text \$\$;
alter table public.platform_settings alter column company_name set default 'KARAY';
SQL
mkdir -p "$WORK/b"
SUPABASE_DB_URL="$OLD_URL" OUT_DIR="$WORK/b" STAMP=kuru-b bash "$HERE/backup-db.sh"
code=0; drill "$WORK/b" kuru-b "$WORK/b.sonuc" || code=$?
check "B geride şema ($PREV) başarısızlık sayılmaz" 0 "$code" "$WORK/b.sonuc" 'BUTUNLUK=TAMAM' 'SEMA=BILGI' "SEMA_SURUM=$PREV"

echo "== C1: bozuk dump (negatif kontrol) =="
mkdir -p "$WORK/c"
cp "$WORK/a/"db-kuru-a.* "$WORK/c/"
printf 'x' >> "$WORK/c/db-kuru-a.dump"
code=0; drill "$WORK/c" kuru-a "$WORK/c.sonuc" || code=$?
check "C1 bozuk dump reddedildi" 1 "$code" "$WORK/c.sonuc" 'BUTUNLUK=HATA'

echo "== C2: uzak hedef (negatif kontrol, bağlantı kurulmaz) =="
code=0
ADMIN_DB_URL='postgresql://postgres@db.example.invalid:5432/postgres' DRILL_RESULT="$WORK/d.sonuc" \
  bash "$HERE/restore-drill.sh" "$WORK/a" kuru-a || code=$?
check "C2 uzak hedef reddedildi (YALITIM)" 2 "$code" "$WORK/d.sonuc"

if [ "$basarisiz" != 0 ]; then echo "✗ Sentetik kuru prova BAŞARISIZ" >&2; exit 1; fi
echo "✓ Sentetik kuru prova: A, B, C1, C2 beklenen sonucu verdi"
