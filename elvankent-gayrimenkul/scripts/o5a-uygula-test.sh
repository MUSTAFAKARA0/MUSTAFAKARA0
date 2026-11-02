#!/usr/bin/env bash
# =============================================================================
# scripts/o5a-uygula.sh SENTETİK testi (yalnız yerel; canlıya bağlanmaz). scripts/canli-denetim-prova.sh 7. adımından,
# canlının birebir kopyası gibi kurulmuş (tarihî demo paketleri, CRLF) boş canlı benzeri yığın (127.0.0.1:55322) açıkken çağrılır.
#   U1 onaysız paket özeti → çıkış 2, hiçbir şey uygulanmaz (tespit 21 VAR kalır)
#   U2 kilit: başka oturum organizations tablosunu kilitliyken → çıkış 3 "kilit beklenmedi (55P03)", kısmi şema TUTARLI kalır
#   U3 kilit kalkınca yeniden çalıştırma → kalan dosyalardan devam, çıkış 0, son kontrol temiz (30 VAR, sürüm 20261011000001,
#      postflight yalnız 27 HATA, geçmişte 9 "AYNI (O-5a kaydı)")
#   U4 bir kez daha → çıkış 2 "hepsi zaten uygulanmış", hiçbir şey yapılmaz
#   U5 günlükte adres/port/parola/SQL metni yok
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
DB=postgresql://postgres:postgres@127.0.0.1:55322/postgres
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fail() { echo "✗ $*" >&2; exit 1; }
PAKET=$(for f in $(ls supabase/ops/o5a/[0-9][0-9]_*.sql | sort); do sha256sum "$f" | cut -d' ' -f1; done | sha256sum | cut -d' ' -f1)
run() { local c=0; env -u GITHUB_ACTIONS -u GITHUB_STEP_SUMMARY O5A_DB_URL="$DB" O5A_SSLMODE=disable "$@" bash scripts/o5a-uygula.sh > "$T/log" 2>&1 || c=$?; echo "$c"; }
var_say() { PGOPTIONS='-c default_transaction_read_only=on' psql "$DB" -X -A -t -F'|' -f supabase/ops/canli_sema_tespiti.sql | awk -F'|' '$1 <= 31 && $3 == "VAR"' | wc -l; }
clean() { for bad in '127.0.0.1' '55322' 'postgresql://' 'postgres:postgres' 'create table' 'create or replace'; do
  grep -qiF -- "$bad" "$T/log" && fail "$1: günlükte yasak içerik"; done; return 0; }

[ "$(var_say)" = 21 ] || fail "başlangıç: 21 VAR bekleniyordu"
c=$(run O5A_PAKET_SHA256=0000)
[ "$c" = 2 ] && grep -q 'onaylanan sürüm değil' "$T/log" && [ "$(var_say)" = 21 ] || { cat "$T/log" >&2; fail "U1 (çıkış $c)"; }
echo "  ✓ U1 onaysız paket: çıkış 2, hiçbir şey uygulanmadı"

psql "$DB" -X -q -c "begin; lock table public.organizations in access exclusive mode; select pg_sleep(25); commit;" > /dev/null 2>&1 &
kilit=$!
sleep 2
c=$(run O5A_PAKET_SHA256="$PAKET")
[ "$c" = 3 ] && grep -q 'kilit beklenmedi' "$T/log" && grep -q 'UYGULANMADI' "$T/log" || { cat "$T/log" >&2; fail "U2 (çıkış $c)"; }
ara=$(var_say)
PGOPTIONS='-c default_transaction_read_only=on' psql "$DB" -X -A -t -F'|' -f supabase/ops/canli_sema_tespiti.sql | grep -q '^103|TUTARLILIK|TAMAM' \
  || fail "U2: kısmi şema tutarsız"
clean U2; echo "  ✓ U2 kilit: çıkış 3 (55P03), $ara/31 VAR, şema tutarlı, kalan dosyalar uygulanmadı"
wait "$kilit" || true

c=$(run O5A_PAKET_SHA256="$PAKET")
[ "$c" = 0 ] && grep -q '^SONUÇ: TAMAM — O-5a uygulandı' "$T/log" && grep -q 'migration 1–30 VAR: 30/30' "$T/log" \
  && grep -q 'karay_schema_version(): 20261011000001' "$T/log" && grep -q 'postflight_v2 HATA satırları: 27 ' "$T/log" \
  && grep -q 'AYNI (O-5a kaydı)=9' "$T/log" || { cat "$T/log" >&2; fail "U3 (çıkış $c)"; }
clean U3; echo "  ✓ U3 devam: $((30 - ara)) dosya uygulandı, son kontrol temiz (30 VAR, sürüm 20261011000001, yalnız 27 HATA, 9 O-5a kaydı)"

c=$(run O5A_PAKET_SHA256="$PAKET")
[ "$c" = 2 ] && grep -q 'hepsi zaten uygulanmış' "$T/log" || { cat "$T/log" >&2; fail "U4 (çıkış $c)"; }
echo "  ✓ U4 tekrar: çıkış 2, hiçbir şey yapılmadı"
echo "✓ O-5a uygulama betiği sentetik testleri tamam (U1–U5)"
