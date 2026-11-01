#!/usr/bin/env bash
# =============================================================================
# O-5 YÜKSELTME PROVASI (yalnız YEREL): canlıyı taklit eden eski şemadan (scripts/live-like-stack.sh) güncel şemaya,
# canlıda izlenecek sırayla. Canlıya, Vercel'e, R2'ye bağlanmaz.
#
#   LIVE_LIKE_SEED=/tmp/seed.sql bash scripts/live-like-stack.sh start 20261008000000
#   DB_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres bash scripts/o5-upgrade-rehearsal.sh
#
# Adımlar (biri başarısız olursa durur):
#   1  supabase/ops/canli_sema_tespiti.sql (salt okunur oturum): ilk eksik migration, TUTARLILIK TAMAM olmalı
#   2  Eksik migration'lar (20261018000001 hariç) dosya sırasıyla, her biri TEK işlemde (psql -1; canlıda SQL Editor);
#      supabase/ops/o5a/NN_<dosya> varsa O DOSYA (migration + geçmiş kaydı) uygulanır
#      — her dosyadan sonra tespit sorgusunda o dosya VAR olmalı
#   3  KARAYS (20261018000001) kendi runbook'uyla: 01 (DUR yok) → 02 → 03 → 04 (DUR/HATA yok)
#   4  supabase/ops/postflight_v2.sql: HATA satırı yok
#   5  Bekleyen dosyalar (supabase/pending) runbook'larıyla: scripts/rehearse-runbooks.sh (01→02→03→04→05→01→03→04)
#   6  Tespit: 31 migration + 8 bekleyen VAR, TUTARLILIK TAMAM
#   7  supabase/ops/canli_migration_gecmisi.sql: FARKLI / İÇERİKSİZ / DEPODA YOK yok; eksik dosyaların hepsi O-5a dosyasıyla
#      uygulandıysa KAYITSIZ da yok (O-5a dosyası = migration + aynı işlemde geçmiş kaydı; supabase/ops/o5a, scripts/o5a-build.sh)
# Yalnız 127.0.0.1 / localhost kabul edilir (sorgu parametresi yok).
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
: "${DB_URL:?DB_URL tanımlı değil (canlı benzeri yığın: postgresql://postgres:postgres@127.0.0.1:55322/postgres)}"
[[ "$DB_URL" =~ ^postgres(ql)?://([^@/?#]*@)?(127\.0\.0\.1|localhost)(:[0-9]+)?/[A-Za-z0-9_]+$ ]] \
  || { echo "✗ YALITIM: DB_URL yerel değil; O-5 provası yalnız yerelde" >&2; exit 2; }
OPS=supabase/ops
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
sql() { psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q "$@"; }
ro() { PGOPTIONS='-c default_transaction_read_only=on' psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q -A -t -F '|' "$@"; }
fail() { echo "✗ $*" >&2; exit 1; }
detect() { ro -f "$OPS/canli_sema_tespiti.sql" > "$OUT/tespit.txt"; }
row() { awk -F'|' -v k="$1" '$1 == k { print $3 }' "$OUT/tespit.txt"; }

echo "== 1/7 Tespit (salt okunur)"
detect
first=$(row 102); consist=$(row 103)
echo "   ilk eksik: $first"
echo "   $consist"
case "$consist" in TAMAM*) ;; *) fail "tutarsız şema; sıra elle incelenmeli" ;; esac
mapfile -t missing < <(awk -F'|' '$1 <= 31 && $3 == "YOK" { print $2 }' "$OUT/tespit.txt")
echo "   eksik: ${#missing[@]} dosya"

echo "== 2/7 Eksik migration'lar (tek işlem, sırayla; KARAYS hariç)"
n=0; unregistered=0
for f in "${missing[@]}"; do
  [ "$f" = 20261018000001_karays_brand.sql ] && continue
  src="supabase/migrations/$f"
  o5a=$(ls "$OPS"/o5a/[0-9][0-9]_"$f" 2>/dev/null || true)
  if [ -n "$o5a" ]; then src=$o5a; else unregistered=$((unregistered + 1)); fi
  echo "   - $src"
  sql -1 -f "$src" > "$OUT/apply.$n.out" 2> "$OUT/apply.$n.err" || { cat "$OUT/apply.$n.err" >&2; fail "$f uygulanamadı (tek işlem: hiçbir şey yarım kalmadı)"; }
  detect
  [ "$(awk -F'|' -v f="$f" '$2 == f { print $3 }' "$OUT/tespit.txt")" = VAR ] || fail "$f uygulandı ama tespit sorgusu VAR demiyor"
  n=$((n + 1))
done
echo "   $n dosya uygulandı"

echo "== 3/7 KARAYS runbook'u (supabase/ops/karays_brand)"
if [ "$(awk -F'|' '$2 == "20261018000001_karays_brand.sql" { print $3 }' "$OUT/tespit.txt")" = YOK ]; then
  ro -f "$OPS/karays_brand/01_preflight.sql" > "$OUT/kb1.out"
  if grep -Eq '\bDUR\b' "$OUT/kb1.out"; then cat "$OUT/kb1.out" >&2; fail "karays_brand/01 DUR verdi"; fi
  ro -f "$OPS/karays_brand/02_rollback_script.sql" > "$OUT/kb2.out"
  sql -f "$OPS/karays_brand/03_apply.sql" > "$OUT/kb3.out" 2> "$OUT/kb3.err" || { cat "$OUT/kb3.err" >&2; fail "karays_brand/03 başarısız"; }
  ro -f "$OPS/karays_brand/04_postflight.sql" > "$OUT/kb4.out"
  if grep -Eq '\b(DUR|HATA)\b' "$OUT/kb4.out"; then cat "$OUT/kb4.out" >&2; fail "karays_brand/04 DUR/HATA verdi"; fi
  echo "   01 DUR yok · 03 uygulandı · 04 DUR/HATA yok"
else
  echo "   zaten uygulanmış"
fi

echo "== 4/7 postflight_v2 (salt okunur)"
ro -c 'set row_security = off' -f "$OPS/postflight_v2.sql" > "$OUT/pf.out"
errors=$(awk -F'|' '$4 ~ /^HATA/' "$OUT/pf.out" | wc -l)
[ "$errors" = 0 ] || { awk -F'|' '$4 ~ /^HATA/ { print "   " $1 ") " $2 ": " $4 }' "$OUT/pf.out" >&2; fail "postflight_v2: $errors HATA"; }
echo "   $(awk -F'|' '$4 == "TAMAM"' "$OUT/pf.out" | wc -l) TAMAM, 0 HATA"

echo "== 5/7 Bekleyen dosyalar (runbook provası)"
DB_URL="$DB_URL" bash scripts/rehearse-runbooks.sh 2>&1 | sed 's/^/   /' | tail -3

echo "== 6/7 Son tespit"
detect
var=$(awk -F'|' '$1 <= 39 && $3 == "VAR"' "$OUT/tespit.txt" | wc -l)
echo "   $var / 39 VAR · $(row 103)"
[ "$var" = 39 ] || fail "son durumda eksik nesne var"

echo "== 7/7 Migration geçmişi (salt okunur)"
ro -f "$OPS/canli_migration_gecmisi.sql" > "$OUT/gecmis.txt"
awk -F'|' '$1 == "ÖZET" { print "   " $2 ": " $3 }' "$OUT/gecmis.txt"
bad=$(awk -F'|' '$1 != "ÖZET" && ($3 == "FARKLI" || $3 == "İÇERİKSİZ" || $3 == "DEPODA YOK")' "$OUT/gecmis.txt" | wc -l)
[ "$bad" = 0 ] || { awk -F'|' '$1 != "ÖZET" && $3 !~ /^(AYNI|KAYITSIZ)/' "$OUT/gecmis.txt" >&2; fail "migration geçmişinde $bad tutarsız kayıt"; }
unreg=$(awk -F'|' '$1 != "ÖZET" && $3 == "KAYITSIZ"' "$OUT/gecmis.txt" | wc -l)
[ "$unreg" = "$unregistered" ] || fail "KAYITSIZ $unreg, beklenen $unregistered (O-5a dosyası olmadan uygulananlar)"
echo "   tutarsız kayıt yok · O-5a dosyası olmadan uygulanan (kayıtsız): $unreg"
echo "✓ O-5 yükseltme provası tamam: $first'den güncel şemaya (+ 8 bekleyen)"
