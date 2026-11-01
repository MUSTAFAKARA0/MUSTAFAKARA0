#!/usr/bin/env bash
# =============================================================================
# scripts/ki23-canli-denetim.sh için SENTETİK test (yalnız yerel; canlıya bağlanmaz). scripts/canli-denetim-prova.sh
# tarafından, tarihî demo paketleriyle kurulmuş canlı benzeri yığın (127.0.0.1:55322) açıkken çağrılır.
#
# Test parolası ve rolü YALNIZ bu yerel yığında oluşturulur; günlükte görünmemeleri sınanır.
#   T1 temiz şema → çıkış 0, "G1–G4: TAMAM", "AYNI=828"; günlükte parola/rol/adres/port/fonksiyon gövdesi/nesne adı YOK
#   T2 RLS kapalı kiracı tablosu + kiracı tablosunda koşulsuz anon politikası → çıkış 4, G1/G2 HATA sayıları, nesne adı YOK
#   T3 onaysız dosya (SHA farklı) → çıkış 2, bağlantı denenmez
#   T4 bekçi: yazma komutu eklenmiş kopya (özeti doğru verilse bile) → çıkış 2
#   T5 yanlış parola → çıkış 3 "kimlik doğrulama", parola günlükte yok
#   T6 kapalı port → çıkış 3, adres/port günlükte yok
#   T7 betiğin PGOPTIONS'ıyla açılan oturumda yazma → SQLSTATE 25006 (oturum gerçekten salt okunur)
#   T8 GitHub maskesi: GITHUB_ACTIONS=true iken adres, kullanıcı, parola, ana makine, port ::add-mask:: ile bildirilir
#   T9 RLS'i aşamayan rol: storage.buckets görünmez → kova EKSİK; betik bunu ayrıca "görünmüyor olabilir" diye yazar
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
ADMIN=postgresql://postgres:postgres@127.0.0.1:55322/postgres
ROLE=ki23_test_okuyucu
PW='Ki23-Test-Parola-7Qz9'
URL="postgresql://$ROLE:$PW@127.0.0.1:55322/postgres"
SQL=supabase/ops/canli_sema_denetimi.sql
SHA=$(sha256sum "$SQL" | cut -d' ' -f1)
T=$(mktemp -d)
cleanup() {
  psql "$ADMIN" -X -q -c "alter table public.leads enable row level security" -c "drop policy if exists ki23_test_acik on public.properties" \
    > /dev/null 2>&1 || true
  psql "postgresql://supabase_admin:postgres@127.0.0.1:55322/postgres" -X -q -c "drop owned by $ROLE" -c "drop role if exists $ROLE" > /dev/null 2>&1 || true
  rm -rf "$T"
}
trap cleanup EXIT
fail() { echo "✗ $*" >&2; exit 1; }
SUPER=postgresql://supabase_admin:postgres@127.0.0.1:55322/postgres
# Canlıdaki yedek rolü gibi: RLS'i aşabilen (yedek iş akışı her tabloyu okuyabiliyor), SQL Editor'ün search_path'i; yazma yetkisi
# vermek gerekmez — oturum zaten salt okunur. (Önce RLS'i aşamayan rolle de denendi: storage.buckets görünmez → kova EKSİK; betik
# bunu "görünmüyor olabilir" diye ayrıca belirtir, T9.)
psql "$SUPER" -X -q -v ON_ERROR_STOP=1 -c "set client_min_messages = warning" -c "drop role if exists $ROLE" -c "create role $ROLE login bypassrls password '$PW'" \
  -c "alter role $ROLE set search_path = \"\$user\", public, extensions" \
  -c "grant usage on schema storage to $ROLE" -c "grant select on storage.buckets to $ROLE" > /dev/null
run() { # çıkış kodunu döndürür; günlük $T/log
  local code=0
  env -u GITHUB_STEP_SUMMARY DENETIM_SSLMODE=disable "$@" bash scripts/ki23-canli-denetim.sh > "$T/log" 2>&1 || code=$?
  echo "$code"
}
clean() { # günlükte sır / adres / gövde / nesne adı yok (::add-mask:: satırları GitHub'da görünmez, hariç)
  local bad
  for bad in "$PW" "$ROLE" '127.0.0.1' '55322' 'postgresql://' 'auth.uid' 'language plpgsql' 'raise exception' 'leads' 'properties' 'ki23_test_acik'; do
    if grep -v '^::add-mask::' "$T/log" | grep -qF -- "$bad"; then fail "$1: günlükte yasak içerik: ${bad:0:4}…"; fi
  done
}

c=$(run DENETIM_DB_URL="$URL" DENETIM_SQL_SHA256="$SHA")
[ "$c" = 0 ] || { cat "$T/log" >&2; fail "T1 çıkış $c"; }
grep -q '^G1–G4: TAMAM$' "$T/log" && grep -q 'P toplam: AYNI=828 FARKLI=0 EKSİK=0 FAZLA=0 (beklenen nesne: 828)' "$T/log" \
  && grep -q 'Oturum salt okunur başladı' "$T/log" || { cat "$T/log" >&2; fail "T1 özet"; }
clean T1; echo "  ✓ T1 temiz şema: TAMAM, 828 AYNI, günlükte sır/adres/gövde/nesne adı yok (ayrı test rolüyle)"

psql "$ADMIN" -X -q -v ON_ERROR_STOP=1 -c "alter table public.leads disable row level security" \
  -c "create policy ki23_test_acik on public.properties for select to anon using (true)" > /dev/null
c=$(run DENETIM_DB_URL="$URL" DENETIM_SQL_SHA256="$SHA")
[ "$c" = 4 ] && grep -q '^  G1 (RLS kapalı public tablo): HATA — 1 nesne$' "$T/log" && grep -q '^  G2 .*: HATA — 1 nesne$' "$T/log" \
  && grep -q 'SONUÇ: BULGU VAR' "$T/log" || { cat "$T/log" >&2; fail "T2 (çıkış $c)"; }
clean T2; echo "  ✓ T2 bozulmuş şema: çıkış 4, G1/G2 sayıları, nesne adı yok"
psql "$ADMIN" -X -q -c "alter table public.leads enable row level security" -c "drop policy ki23_test_acik on public.properties" > /dev/null

c=$(run DENETIM_DB_URL="$URL" DENETIM_SQL_SHA256=0000)
[ "$c" = 2 ] && grep -q 'onaylanan sürüm değil' "$T/log" && ! grep -q 'Oturum' "$T/log" || fail "T3 (çıkış $c)"
echo "  ✓ T3 onaysız dosya: çıkış 2, bağlantı denenmedi"

sed 's/^order by 1, 2;$/order by 1, 2; delete from public.leads;/' "$SQL" > "$T/kotu.sql"
c=$(run DENETIM_DB_URL="$URL" DENETIM_SQL="$T/kotu.sql" DENETIM_SQL_SHA256="$(sha256sum "$T/kotu.sql" | cut -d' ' -f1)")
[ "$c" = 2 ] && grep -q 'Bekçi' "$T/log" && ! grep -q 'Oturum' "$T/log" || fail "T4 (çıkış $c)"
echo "  ✓ T4 bekçi: yazma komutlu kopya reddedildi, bağlantı denenmedi"

c=$(run DENETIM_DB_URL="postgresql://$ROLE:Yanlis-Parola-55x@127.0.0.1:55322/postgres" DENETIM_SQL_SHA256="$SHA")
[ "$c" = 3 ] && grep -q 'kimlik doğrulama başarısız' "$T/log" && ! grep -qF 'Yanlis-Parola-55x' "$T/log" || { cat "$T/log" >&2; fail "T5 (çıkış $c)"; }
clean T5; echo "  ✓ T5 yanlış parola: çıkış 3, güvenli sınıf, parola yok"

c=$(run DENETIM_DB_URL="postgresql://$ROLE:$PW@127.0.0.1:59999/postgres" DENETIM_SQL_SHA256="$SHA")
[ "$c" = 3 ] && grep -q 'bağlantı kurulamadı' "$T/log" && ! grep -q '59999' "$T/log" || { cat "$T/log" >&2; fail "T6 (çıkış $c)"; }
clean T6; echo "  ✓ T6 kapalı port: çıkış 3, adres/port yok"

opts=$(grep -oE "^export PGOPTIONS='[^']+'" scripts/ki23-canli-denetim.sh | sed -E "s/^export PGOPTIONS='(.*)'$/\1/")
[ -n "$opts" ] || fail "T7: PGOPTIONS bulunamadı"
if PGOPTIONS="$opts" psql "$URL" -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -c "create temp table ki23_yazma (x int)" > /dev/null 2> "$T/err7"; then
  fail "T7: salt okunur oturumda yazma başarılı oldu"
fi
grep -q '25006' "$T/err7" || fail "T7: 25006 beklenirdi"
echo "  ✓ T7 betiğin oturumu salt okunur: yazma SQLSTATE 25006 ile reddedildi"

c=$(run GITHUB_ACTIONS=true DENETIM_DB_URL="$URL" DENETIM_SQL_SHA256="$SHA")
for m in "$URL" "$ROLE" "$PW" 127.0.0.1 55322; do grep -qxF "::add-mask::$m" "$T/log" || fail "T8: maske eksik"; done
[ "$c" = 0 ] || fail "T8 çıkış $c"
echo "  ✓ T8 GitHub maskesi: adres, kullanıcı, parola, ana makine, port maskelendi"
psql "$SUPER" -X -q -v ON_ERROR_STOP=1 -c "alter role $ROLE nobypassrls" > /dev/null
c=$(run DENETIM_DB_URL="$URL" DENETIM_SQL_SHA256="$SHA")
[ "$c" = 4 ] && grep -q 'kova: AYNI=0 FARKLI=0 EKSİK=4' "$T/log" && grep -q 'storage.buckets bu rolle görünmüyor olabilir' "$T/log" \
  || { cat "$T/log" >&2; fail "T9 (çıkış $c)"; }
clean T9; echo "  ✓ T9 RLS'i aşamayan rol: kova EKSİK ayrıca 'görünmüyor olabilir' diye işaretlendi"
echo "✓ KI-23 canlı denetim betiği sentetik testleri tamam (9/9)"
