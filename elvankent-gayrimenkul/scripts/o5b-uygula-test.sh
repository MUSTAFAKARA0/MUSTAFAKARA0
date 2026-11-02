#!/usr/bin/env bash
# =============================================================================
# scripts/o5b-uygula.sh (O-5 Aşama 3) SENTETİK testi — yalnız YEREL; canlıya bağlanmaz. Kendi canlı benzeri yığınını kurar
# (scripts/live-like-stack.sh, 127.0.0.1:55322, kesim 20261002000000 = canlının 01.11 hâli + demo verisi), üzerine canlıda
# 02.11'de yapılanı uygular (O-5a 9 dosyası + KARAYS 03), sonra:
#   V1 onaysız paket özeti → çıkış 2, hiçbir şey uygulanmaz
#   V2 kilit: başka oturum properties tablosunu uzun süre kilitliyken → 3 deneme, çıkış 3 (01 DUR ya da 55P03), quota_lock YOK, şema tutarlı
#   V3 kısa kilit varken yeniden çalıştırma → yeniden deneme ile geçer; 4 runbook, çıkış 0, son kontrol temiz
#      (35 VAR, medya 4 YOK, sürüm 20261018000001, postflight HATA yok, bayrak false, geçmiş 31 kayıt)
#   V4 bir kez daha → çıkış 2 "hepsi zaten uygulanmış"
#   V5 günlükte adres/port/parola/SQL metni yok
#   bash scripts/o5b-uygula-test.sh        (sonunda yığını durdurur; KEEP_STACK=1 ile açık bırakır)
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
DB=postgresql://postgres:postgres@127.0.0.1:55322/postgres
ADMIN=postgresql://supabase_admin:postgres@127.0.0.1:55322/postgres
T=$(mktemp -d)
trap 'rm -rf "$T"; [ -n "${KEEP_STACK:-}" ] || bash scripts/live-like-stack.sh stop > /dev/null 2>&1 || true' EXIT
fail() { echo "✗ $*" >&2; exit 1; }
PAKET=$(for rb in quota_lock ops02_limits media_quota_lock company_name; do ls supabase/ops/$rb/0[134]*.sql; done \
  | while read -r f; do sha256sum "$f" | cut -d' ' -f1; done | sha256sum | cut -d' ' -f1)
run() { local c=0; env -u GITHUB_ACTIONS -u GITHUB_STEP_SUMMARY O5B_DB_URL="$ADMIN" O5B_SSLMODE=disable O5B_BEKLE_SN=2 "$@" \
  bash scripts/o5b-uygula.sh > "$T/log" 2>&1 || c=$?; echo "$c"; }
tespit() { PGOPTIONS='-c default_transaction_read_only=on' psql "$DB" -X -A -t -F'|' -f supabase/ops/canli_sema_tespiti.sql; }
clean() { for bad in '127.0.0.1' '55322' 'postgresql://' 'postgres:postgres' 'create table' 'create or replace' 'create trigger'; do
  grep -qiF -- "$bad" "$T/log" && fail "$1: günlükte yasak içerik"; done; return 0; }

echo "== kurulum: canlı benzeri yığın (kesim 20261002000000) + O-5a + KARAYS"
bash scripts/live-like-stack.sh start 20261002000000 > /dev/null
for f in $(ls supabase/ops/o5a/[0-9][0-9]_*.sql | sort); do
  psql "$ADMIN" -X -q -v ON_ERROR_STOP=1 -1 -f "$f" > /dev/null || fail "kurulum: $f"
done
psql "$ADMIN" -X -q -v ON_ERROR_STOP=1 -f supabase/ops/karays_brand/03_apply.sql > /dev/null 2>&1 || fail "kurulum: KARAYS 03"
[ "$(tespit | awk -F'|' '$1 <= 31 && $3 == "VAR"' | wc -l)" = 31 ] || fail "kurulum: 31 VAR bekleniyordu"

c=$(run O5B_PAKET_SHA256=0000)
[ "$c" = 2 ] && grep -q 'onaylanan sürüm değil' "$T/log" && tespit | grep -q '^32|.*|YOK' || { cat "$T/log" >&2; fail "V1 (çıkış $c)"; }
echo "  ✓ V1 onaysız paket: çıkış 2, hiçbir şey uygulanmadı"

psql "$ADMIN" -X -q -c "begin; lock table public.properties in access exclusive mode; select pg_sleep(30); commit;" > /dev/null 2>&1 &
kilit=$!
sleep 2
c=$(run O5B_PAKET_SHA256="$PAKET")
[ "$c" = 3 ] && grep -qE 'kilit beklenmedi|DUR var \(3 denemede\)' "$T/log" && grep -q 'yeniden denenecek (2/3)' "$T/log" && grep -q 'UYGULANMADI' "$T/log" \
  || { cat "$T/log" >&2; fail "V2 (çıkış $c)"; }
tespit | grep -q '^32|.*|YOK' || fail "V2: quota_lock uygulanmış görünüyor"
tespit | grep -q '^103|TUTARLILIK|TAMAM' || fail "V2: şema tutarsız"
clean V2; echo "  ✓ V2 uzun kilit: 3 deneme, çıkış 3, hiçbir runbook uygulanmadı, şema tutarlı"
wait "$kilit" || true

psql "$ADMIN" -X -q -c "begin; lock table public.properties in access exclusive mode; select pg_sleep(7); commit;" > /dev/null 2>&1 &
kilit=$!
sleep 1
c=$(run O5B_PAKET_SHA256="$PAKET" O5B_BEKLE_SN=9)
wait "$kilit" || true
[ "$c" = 0 ] && grep -q '^SONUÇ: TAMAM — Aşama 3 uygulandı (4 runbook' "$T/log" && grep -q 'yeniden denenecek (1/3)' "$T/log" \
  && grep -q 'migration 1–35 VAR: 35/35 · medya birimleri (36–39) YOK: 4/4' "$T/log" \
  && grep -q 'enforce_subscription_limits: false' "$T/log" && grep -q '03b doğrulandı' "$T/log" \
  || { cat "$T/log" >&2; fail "V3 (çıkış $c)"; }
clean V3; echo "  ✓ V3 kısa kilit: yeniden denemeyle geçti; 4 runbook, son kontrol temiz (35 VAR, medya YOK, bayrak false, 31 kayıt)"

c=$(run O5B_PAKET_SHA256="$PAKET")
[ "$c" = 2 ] && grep -q 'hepsi zaten uygulanmış' "$T/log" || { cat "$T/log" >&2; fail "V4 (çıkış $c)"; }
echo "  ✓ V4 tekrar: çıkış 2, hiçbir şey yapılmadı"
echo "✓ O-5 Aşama 3 uygulama betiği sentetik testleri tamam (V1–V5)"
