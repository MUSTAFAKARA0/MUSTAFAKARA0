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
#   D  CANLININ GERÇEK DURUMU (LIVE_DB_URL + LIVE_DRILL_URL verilirse; CI'da zorunlu: REQUIRE_LIVE_LIKE=1):
#      scripts/live-like-stack.sh ile kurulan ikinci yerel yığın — karay_schema_version() YOK, birden çok migration eksik.
#      D1 sağlam yedek                         → BÜTÜNLÜK TAMAM, ŞEMA BİLGİ, çıkış 0
#      D2 aynı şema + RLS'si kapalı tablo      → ŞEMA HATA, çıkış 3 (gecikme bahanesiyle gizlenmez)
#      D3 aynı şema + kiracı listesi herkese açık politika (postflight "…uygulanmamış" der ama sonraki migration'lar var)
#                                              → ŞEMA HATA, çıkış 3 (tutarsız eksik)
#      D4 aynı şema + sunucuya özel davet fonksiyonu anon'a açık → ŞEMA HATA, çıkış 3
#   S  K6 Storage gidiş-dönüş (STORAGE_DRILL_URL + STORAGE_DRILL_KEY verilirse; CI'da zorunlu: REQUIRE_STORAGE=1):
#      S1 sentetik "fotoğraflar" (rastgele baytlar, boş dosya ve 3 MB dahil) yerel geçici kovaya yüklenip geri
#         indirilir → STORAGE=TAMAM; S2 uzak Storage adresi → YALITIM, çıkış 2 (istek gönderilmez)
# Geçici veritabanları ve dosyalar her durumda silinir.
# =============================================================================
set -euo pipefail

: "${DB_URL:?DB_URL tanımlı değil}"
: "${DRILL_URL:?DRILL_URL tanımlı değil}"
LOCAL_URL_RE='^postgres(ql)?://([^@/?#]*@)?(127\.0\.0\.1|localhost|\[::1\])(:[0-9]{1,5})?/[A-Za-z0-9_]+$'
LIVE_DB_URL=${LIVE_DB_URL:-}
LIVE_DRILL_URL=${LIVE_DRILL_URL:-}
if [ "${REQUIRE_LIVE_LIKE:-0}" = 1 ] && { [ -z "$LIVE_DB_URL" ] || [ -z "$LIVE_DRILL_URL" ]; }; then
  echo "✗ REQUIRE_LIVE_LIKE=1 ama LIVE_DB_URL / LIVE_DRILL_URL yok (scripts/live-like-stack.sh start)" >&2; exit 1
fi
if [ "${REQUIRE_STORAGE:-0}" = 1 ] && { [ -z "${STORAGE_DRILL_URL:-}" ] || [ -z "${STORAGE_DRILL_KEY:-}" ]; }; then
  echo "✗ REQUIRE_STORAGE=1 ama STORAGE_DRILL_URL / STORAGE_DRILL_KEY yok" >&2; exit 1
fi
for u in DB_URL DRILL_URL ${LIVE_DB_URL:+LIVE_DB_URL} ${LIVE_DRILL_URL:+LIVE_DRILL_URL}; do
  [[ "${!u}" =~ $LOCAL_URL_RE ]] || { echo "✗ YALITIM: $u yerel test sunucusu değil — sentetik prova yalnız yerelde çalışır" >&2; exit 2; }
done
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
WORK=$(mktemp -d)
OLD_DB="karay_kuru_eski_$$"
OLD_URL=$(sed -E "s#^(postgres(ql)?://[^/]+)/.*#\1/$OLD_DB#" <<< "$DRILL_URL")
BAD_DB="karay_kuru_bozuk_$$"
cleanup() {
  local code=$?
  psql "$DRILL_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$OLD_DB\" with (force)" > /dev/null 2>&1 || true
  if [ -n "$LIVE_DRILL_URL" ]; then
    psql "$LIVE_DRILL_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$BAD_DB\" with (force)" > /dev/null 2>&1 || true
  fi
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
drill() { # klasör, stamp, sonuç dosyası [, yönetici adresi] → çıkış kodu
  local code=0
  ADMIN_DB_URL="${4:-$DRILL_URL}" DRILL_RESULT="$3" bash "$HERE/restore-drill.sh" "$1" "$2" || code=$?
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

if [ -n "$LIVE_DB_URL" ]; then
  echo "== D1: canlının gerçek durumu — sürüm fonksiyonu yok, birden çok migration eksik (sağlam yedek) =="
  [ "$(psql "$LIVE_DB_URL" -X -At -c "select to_regprocedure('public.karay_schema_version()') is null")" = t ] \
    || { echo "✗ Canlı benzeri yığında karay_schema_version() var; senaryo canlıyı taklit etmiyor" >&2; exit 1; }
  mkdir -p "$WORK/d1"
  SUPABASE_DB_URL="$LIVE_DB_URL" OUT_DIR="$WORK/d1" STAMP=kuru-d1 bash "$HERE/backup-db.sh"
  code=0; drill "$WORK/d1" kuru-d1 "$WORK/d1.sonuc" "$LIVE_DRILL_URL" || code=$?
  check "D1 canlı benzeri sağlam yedek: bütünlük TAMAM, şema BİLGİ" 0 "$code" "$WORK/d1.sonuc" 'BUTUNLUK=TAMAM' 'SEMA=BILGI' 'SEMA_SURUM=yok'
  BAD_URL=$(sed -E "s#^(postgres(ql)?://[^/]+)/.*#\1/$BAD_DB#" <<< "$LIVE_DRILL_URL")
  # Her negatif kontrol: D1 yedeği geçici veritabanına yüklenir, tek bir güvenlik hatası eklenir, yedeği alınıp prova edilir
  bozuk() { # ad, SQL
    local name=$1 sql=$2 dir="$WORK/$1"
    echo "== $name =="
    psql "$LIVE_DRILL_URL" -X -q -v ON_ERROR_STOP=1 -c "set client_min_messages = warning" -c "drop database if exists \"$BAD_DB\" with (force)" -c "create database \"$BAD_DB\" template template0" > /dev/null
    pg_restore --no-owner --single-transaction --exit-on-error --dbname "$BAD_URL" "$WORK/d1/db-kuru-d1.dump"
    psql "$BAD_URL" -X -q -v ON_ERROR_STOP=1 -c "$sql" > /dev/null
    mkdir -p "$dir"
    SUPABASE_DB_URL="$BAD_URL" OUT_DIR="$dir" STAMP=kuru-bozuk bash "$HERE/backup-db.sh" > /dev/null
    code=0; drill "$dir" kuru-bozuk "$dir.sonuc" "$LIVE_DRILL_URL" > "$dir.log" 2>&1 || code=$?
    grep -E '^(ŞEMA|BÜTÜNLÜK):|^    [0-9]+\)|bilgi sayılmadı' "$dir.log" | sed 's/^/    /' || true
  }
  bozuk D2 'alter table public.properties disable row level security'
  check "D2 canlı benzeri şema + RLS kapalı tablo: gizlenmedi" 3 "$code" "$WORK/D2.sonuc" 'BUTUNLUK=TAMAM' 'SEMA=HATA'
  bozuk D3 "create policy organizations_public_read on public.organizations for select to anon using (true)"
  check "D3 canlı benzeri şema + kiracı listesi herkese açık: tutarsız eksik, gizlenmedi" 3 "$code" "$WORK/D3.sonuc" 'BUTUNLUK=TAMAM' 'SEMA=HATA'
  bozuk D4 "grant execute on function public.invitation_accept(text, text) to anon"
  check "D4 canlı benzeri şema + sunucuya özel fonksiyon anon'a açık: gizlenmedi" 3 "$code" "$WORK/D4.sonuc" 'BUTUNLUK=TAMAM' 'SEMA=HATA'
  psql "$LIVE_DRILL_URL" -X -q -v ON_ERROR_STOP=1 -c "drop database if exists \"$BAD_DB\" with (force)" > /dev/null
else
  echo "== D: atlandı (LIVE_DB_URL / LIVE_DRILL_URL yok; CI'da zorunlu) =="
fi

if [ -n "${STORAGE_DRILL_URL:-}" ] && [ -n "${STORAGE_DRILL_KEY:-}" ]; then
  echo "== S1: K6 Storage gidiş-dönüş (sentetik fotoğraflar → yerel geçici kova → geri indirme → SHA-256) =="
  mkdir -p "$WORK/s/media-originals/org/ilan" "$WORK/s/branding"
  for i in $(seq 1 20); do head -c $((i * 4099 + 17)) /dev/urandom > "$WORK/s/media-originals/org/ilan/$i"; done
  head -c 3000000 /dev/urandom > "$WORK/s/media-originals/org/ilan/buyuk"
  : > "$WORK/s/branding/bos"
  for i in 1 2 3; do printf '\xff\xd8\xff\xe0sentetik-jpeg-%s' "$i" > "$WORK/s/branding/logo$i.jpg"; done
  code=0; node "$HERE/storage-roundtrip-drill.mjs" --from="$WORK/s" --result="$WORK/s.sonuc" --min=20 || code=$?
  check "S1 K6 sentetik Storage gidiş-dönüş" 0 "$code" "$WORK/s.sonuc" 'STORAGE=TAMAM' 'STORAGE_DOSYA=25' 'STORAGE_AYNI=25'
  echo "== S2: uzak Storage adresi (negatif kontrol, istek gönderilmez) =="
  code=0; STORAGE_DRILL_URL=https://ornek-proje.supabase.co node "$HERE/storage-roundtrip-drill.mjs" --from="$WORK/s" || code=$?
  check "S2 uzak Storage reddedildi (YALITIM)" 2 "$code" /dev/null
else
  echo "== S: atlandı (STORAGE_DRILL_URL / STORAGE_DRILL_KEY yok; CI'da zorunlu) =="
fi

if [ "$basarisiz" != 0 ]; then echo "✗ Sentetik kuru prova BAŞARISIZ" >&2; exit 1; fi
echo "✓ Sentetik kuru prova: A, B, C1, C2${LIVE_DB_URL:+, D1–D4}${STORAGE_DRILL_KEY:+, S1–S2} beklenen sonucu verdi"
