#!/usr/bin/env bash
# O-5 runbook provasi: supabase/ops/<runbook>/ betiklerini YEREL veritabaninda tekrarlanabilir sekilde dener.
#
#   DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash scripts/rehearse-runbooks.sh
#
# Her runbook icin sira: 01 -> 02 -> 03 -> 04 -> 05 -> 01 -> 03 -> 04 (03b_validate.sql varsa son 03'ten sonra).
# Kontroller: 01/04 ciktilarinda DUR yok (04'te HATA da yok); ilk 01 ile geri donus sonrasi 01 ciktisi AYNI.
# Son durum: her runbook yeniden uygulanmis (03 en son) = "tum bekleyenler uygulanmis".
# Negatif kontrol: temiz veritabaninda ops02_limits/03, quota_lock yokken HATA vermeli ve iz birakmamali.
# Yalnizca 127.0.0.1 / localhost kabul edilir; hicbir uzak veritabanina baglanilmaz. Sorgu parametresi
# (?host=, ?hostaddr=, ?service=) libpq'da ana makineyi degistirebildigi icin hic kabul edilmez.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

: "${DB_URL:?DB_URL tanimli degil (yerel Supabase: supabase status -o env)}"
if [[ ! "$DB_URL" =~ ^postgres(ql)?://([^@/]*@)?(127\.0\.0\.1|localhost)(:[0-9]+)?(/[A-Za-z0-9_]+)?$ ]]; then
  echo "HATA: DB_URL yerel degil (yalnizca 127.0.0.1 / localhost); runbook provasi uzak veritabaninda calismaz" >&2
  exit 2
fi

OPS=supabase/ops
RUNBOOKS=(quota_lock ops02_limits media_quota_lock company_name)
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT

sql() { psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q "$@"; }
fail() { echo "HATA: $*" >&2; exit 1; }

# Adim calistirir; cikti $OUT/<runbook>.<etiket>.out dosyasina yazilir
step() { # runbook dosya etiket
  local rb="$1" file="$2" label="$3"
  echo "  - $rb/$file ($label)"
  # 01/02/04 "yalnizca okur": salt okunur oturumda calisir, bir yazma eklenirse prova kirmizi olur
  local ro=""
  case "$file" in 01_*|02_*|04_*) ro="-c default_transaction_read_only=on" ;; esac
  PGOPTIONS="$ro" sql -f "$OPS/$rb/$file" >"$OUT/$rb.$label.out" 2>"$OUT/$rb.$label.err" || {
    cat "$OUT/$rb.$label.err" >&2
    fail "$rb/$file ($label) basarisiz"
  }
}
no_dur() { # runbook etiket [HATA da yasak]
  if grep -Eq '\bDUR\b' "$OUT/$1.$2.out"; then cat "$OUT/$1.$2.out" >&2; fail "$1 ($2) ciktisinda DUR var"; fi
  if [ "${3:-}" = hata ] && grep -Eq '\bHATA\b' "$OUT/$1.$2.out"; then cat "$OUT/$1.$2.out" >&2; fail "$1 ($2) ciktisinda HATA var"; fi
}

# --- Negatif kontrol (temiz durumda, quota_lock'tan ONCE) --------------------------------------------------
if [ -f "$OPS/ops02_limits/03_apply.sql" ]; then
  echo "== negatif kontrol: quota_lock yokken ops02_limits/03 reddedilmeli"
  col="select count(*) from information_schema.columns where table_schema='public' and table_name='platform_settings' and column_name='enforce_subscription_limits'"
  trg="select count(*) from pg_trigger where tgname='aa_quota_lock' and not tgisinternal"
  c_col="$(sql -Atc "$col")" || fail "veritabani okunamadi (negatif kontrol)"
  c_trg="$(sql -Atc "$trg")" || fail "veritabani okunamadi (negatif kontrol)"
  if [ "$c_col" != 0 ] || [ "$c_trg" != 0 ]; then
    # Prova yalnizca temiz (yalnizca migration + seed) veritabaninda anlamlidir: 05 sonrasi 01 ilk 01 ile karsilastirilir
    fail "prova temiz veritabani gerektirir (bekleyen dosyalar uygulanmis). Yerelde once: supabase db reset ve seed"
  else
    if sql -f "$OPS/ops02_limits/03_apply.sql" >"$OUT/neg.out" 2>"$OUT/neg.err"; then
      fail "ops02_limits/03 quota_lock yokken BASARILI oldu (reddedilmeliydi)"
    fi
    grep -q 'aa_quota_lock eksik' "$OUT/neg.err" || { cat "$OUT/neg.err" >&2; fail "ops02_limits/03 beklenen korumayla (aa_quota_lock eksik) reddedilmedi"; }
    [ "$(sql -Atc "$col")" = 0 ] || fail "reddedilen ops02_limits/03 sutun biraktı (enforce_subscription_limits)"
    echo "  tamam: reddedildi, iz yok"
    # Olumlu kontrol: DUR denetimi gercekten eslesiyor mu (quota_lock yokken media 01 DUR basmali)
    if [ -f "$OPS/media_quota_lock/01_preflight.sql" ]; then
      step media_quota_lock 01_preflight.sql control
      grep -Eq '\bDUR\b' "$OUT/media_quota_lock.control.out" || fail "olumlu kontrol: media_quota_lock/01 quota_lock yokken DUR basmadi"
      echo "  tamam: DUR denetimi eslesiyor (olumlu kontrol)"
    fi
  fi
fi

# --- Runbook donguleri --------------------------------------------------------------------------------------
ran=0
for rb in "${RUNBOOKS[@]}"; do
  if [ ! -d "$OPS/$rb" ]; then
    [ -z "${CI:-}" ] || fail "$OPS/$rb yok (CI'da tum runbook'lar bulunmali)"
    echo "== $rb: $OPS/$rb henuz yok, ATLANDI"
    continue
  fi
  echo "== $rb"
  step "$rb" 01_preflight.sql   pre1;  no_dur "$rb" pre1
  step "$rb" 02_save_state.sql  save
  step "$rb" 03_apply.sql       apply1
  step "$rb" 04_postflight.sql  post1;  no_dur "$rb" post1 hata
  step "$rb" 05_rollback.sql    rollback
  step "$rb" 01_preflight.sql   pre2;  no_dur "$rb" pre2
  diff -u "$OUT/$rb.pre1.out" "$OUT/$rb.pre2.out" >"$OUT/$rb.diff" || { cat "$OUT/$rb.diff" >&2; fail "$rb: geri donus sonrasi 01 ciktisi ilk 01 ile ayni degil"; }
  step "$rb" 03_apply.sql       apply2
  [ ! -f "$OPS/$rb/03b_validate.sql" ] || step "$rb" 03b_validate.sql validate
  step "$rb" 04_postflight.sql  post2;  no_dur "$rb" post2 hata
  ran=$((ran + 1))
done

[ "$ran" -gt 0 ] || fail "hicbir runbook calistirilmadi"
echo "TAMAM: $ran runbook denendi; hepsi yeniden uygulanmis durumda"
