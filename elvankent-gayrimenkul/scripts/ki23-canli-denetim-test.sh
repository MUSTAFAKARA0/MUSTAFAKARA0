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
#   T10 betiğin sarmalayıcısı (birebir) + havuz PGOPTIONS'ı yok sayarsa (varsayılan off): BEGIN READ ONLY ile işlem on → denetim
#       aynı işlemde ÇALIŞIR (canlı #4 durumu)
#   T11 sarmalayıcı + betiğin PGOPTIONS'ı + bekçiyi atlatmış yazma dosyası: aynı işlemde 25006, hiçbir şey oluşmaz
#   T12 yalnız BEGIN READ ONLY (PGOPTIONS yok, kapı zorla açık): yazma yine 25006 — iki katmandan biri yeterli
#   T13 betik uçtan uca: denetim yarıda hata verirse çıkış 3 "işlem geri alındı", ham hata/SQL metni yok
#   T14 betik uçtan uca, varsayılan off / işlem on (bağlantı adresindeki options ile havuz davranışı taklit edilir): çıkış 0,
#       828 AYNI, günlükte "varsayılan … (bilgi): off", adres/parola yok
#   T15 sarmalayıcıda işlem salt okunur DEĞİL (BEGIN READ ONLY → BEGIN, varsayılan off): kapı kapalı → denetim (burada yazma
#       dosyası) DAHİL EDİLMEZ, hiçbir şey oluşmaz
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
ADMIN=postgresql://postgres:postgres@127.0.0.1:55322/postgres
ROLE=ki23_test_okuyucu
PW='Ki23-Test-Parola-7Qz9'
URL="postgresql://$ROLE:$PW@127.0.0.1:55322/postgres"
SQL=supabase/ops/canli_sema_denetimi.sql
SHA=$(sha256sum "$SQL" | cut -d' ' -f1)
TSHA=$(sha256sum supabase/ops/canli_fonksiyon_teshis.sql | cut -d' ' -f1)
T=$(mktemp -d)
cleanup() {
  psql "$ADMIN" -X -q -c "alter table public.leads enable row level security" -c "drop policy if exists ki23_test_acik on public.properties" \
    -c "drop table if exists public.ki23_yazma_denemesi" > /dev/null 2>&1 || true
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
  # CI'da GITHUB_ACTIONS=true gelir: T1–T7 yerelle aynı koşsun diye kaldırılır (::add-mask:: satırları test parolasını içerir;
  # GitHub bunları günlükte göstermez). T8 değişkeni açıkça verir.
  env -u GITHUB_STEP_SUMMARY -u GITHUB_ACTIONS DENETIM_SSLMODE=disable DENETIM_TESHIS_SHA256="$TSHA" "$@" bash scripts/ki23-canli-denetim.sh > "$T/log" 2>&1 || code=$?
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
  && grep -q '^Fonksiyon teşhisi: beklenen=77 eşleşen imza=77 başlık AYNI=77 gövde ham AYNI=77 gövde (CR çıkarılınca) AYNI=77 CR içeren gövde=0 beklenmeyen=0$' "$T/log" \
  && grep -q '^SONUÇ: TAMAM — G1–G4 temiz, 828 nesnenin hepsi AYNI$' "$T/log" \
  && grep -q 'Tek bağlantı, tek işlem: BEGIN READ ONLY → işlem salt okunur=on (güvenlik kapısı) → denetim → ROLLBACK' "$T/log" \
  && grep -q '^• Varsayılan salt okunur ayar (bilgi): on; PostgreSQL ana sürüm' "$T/log" \
  || { cat "$T/log" >&2; fail "T1 özet"; }
clean T1; echo "  ✓ T1 temiz şema: TAMAM, 828 AYNI, günlükte sır/adres/gövde/nesne adı yok (ayrı test rolüyle)"

psql "$ADMIN" -X -q -v ON_ERROR_STOP=1 -c "alter table public.leads disable row level security" \
  -c "create policy ki23_test_acik on public.properties for select to anon using (true)" > /dev/null
c=$(run DENETIM_DB_URL="$URL" DENETIM_SQL_SHA256="$SHA")
[ "$c" = 4 ] && grep -q '^  G1 (RLS kapalı public tablo): HATA — 1 nesne$' "$T/log" && grep -q '^  G2 .*: HATA — 1 nesne$' "$T/log" \
  && grep -q 'SONUÇ: BULGU VAR' "$T/log" || { cat "$T/log" >&2; fail "T2 (çıkış $c)"; }
clean T2; echo "  ✓ T2 bozulmuş şema: çıkış 4, G1/G2 sayıları, nesne adı yok"
psql "$ADMIN" -X -q -c "alter table public.leads enable row level security" -c "drop policy ki23_test_acik on public.properties" > /dev/null

c=$(run DENETIM_DB_URL="$URL" DENETIM_SQL_SHA256="$SHA" DENETIM_TESHIS_SHA256=0000)
[ "$c" = 2 ] && grep -q 'Teşhis dosyası onaylanan sürüm değil' "$T/log" && ! grep -q 'Tek bağlantı' "$T/log" || fail "T3b (çıkış $c)"
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
psql "$SUPER" -X -q -v ON_ERROR_STOP=1 -c "alter role $ROLE bypassrls" > /dev/null
# Sarmalayıcı, betikteki işaretler arasından BİREBİR alınır
body=$(sed -n '/^# SARMALAYICI-BAS/,/^# SARMALAYICI-SON/p' scripts/ki23-canli-denetim.sh | sed '1d;$d')
eval "wrap() {
$body
}"
printf 'with x as (select 1 as n) select n from x;\n' > "$T/oku.sql"
printf 'create table public.ki23_yazma_denemesi (x int);\n' > "$T/yaz.sql"
opts=$(grep -oE "^export PGOPTIONS='[^']+'" scripts/ki23-canli-denetim.sh | sed -E "s/^export PGOPTIONS='(.*)'$/\1/")

wrap "$T/oku.sql" > "$T/r10.sql"
PGOPTIONS='' psql "$URL" -X -q -A -t -F'|' -v ON_ERROR_STOP=1 -f "$T/r10.sql" > "$T/o10" 2> "$T/e10" || fail "T10 psql"
grep -qx 'KONTROL|off|on|[0-9]*' "$T/o10" && grep -qx '1' "$T/o10" && ! grep -q 'GONDERILMEDI' "$T/o10" || { cat "$T/o10" >&2; fail "T10"; }
echo "  ✓ T10 havuz PGOPTIONS'ı yok sayarsa (varsayılan off): işlem on → denetim aynı işlemde çalıştı"

wrap "$T/yaz.sql" > "$T/r11.sql"
if PGOPTIONS="$opts" psql "$URL" -X -q -A -t -F'|' -v ON_ERROR_STOP=1 -f "$T/r11.sql" > "$T/o11" 2> "$T/e11"; then fail "T11: yazma başarılı oldu"; fi
grep -q '25006' "$T/e11" || { cat "$T/e11" >&2; fail "T11: 25006 beklenirdi"; }
[ "$(psql "$ADMIN" -X -At -c "select to_regclass('public.ki23_yazma_denemesi') is null")" = t ] || fail "T11: tablo oluştu"
echo "  ✓ T11 bekçiyi atlatmış yazma: aynı işlemde 25006, hiçbir şey oluşmadı"

sed 's/^\\if :ro_tamam$/\\if true/' "$T/r11.sql" > "$T/r12.sql"
grep -qx '\\if true' "$T/r12.sql" || fail "T12 hazırlık"
if PGOPTIONS='' psql "$URL" -X -q -A -t -F'|' -v ON_ERROR_STOP=1 -f "$T/r12.sql" > "$T/o12" 2> "$T/e12"; then fail "T12: yazma başarılı oldu"; fi
grep -q '25006' "$T/e12" && [ "$(psql "$ADMIN" -X -At -c "select to_regclass('public.ki23_yazma_denemesi') is null")" = t ] || fail "T12"
echo "  ✓ T12 yalnız BEGIN READ ONLY (PGOPTIONS yok): yazma yine 25006"

printf 'with x as (select 1 / 0 as n) select n from x;\n' > "$T/hata.sql"
c=$(run DENETIM_DB_URL="$URL" DENETIM_SQL="$T/hata.sql" DENETIM_SQL_SHA256="$(sha256sum "$T/hata.sql" | cut -d' ' -f1)")
[ "$c" = 3 ] && grep -q 'Denetim çalışmadı (işlem geri alındı): SQL hatası (SQLSTATE 22012)' "$T/log" && ! grep -q '1 / 0\|division' "$T/log" \
  || { cat "$T/log" >&2; fail "T13 (çıkış $c)"; }
clean T13; echo "  ✓ T13 denetim yarıda hata: çıkış 3, işlem geri alındı, yalnız SQLSTATE"
c=$(run DENETIM_DB_URL="$URL?options=-c%20default_transaction_read_only%3Doff" DENETIM_SQL_SHA256="$SHA")
[ "$c" = 0 ] && grep -q '^• Varsayılan salt okunur ayar (bilgi): off (bağlantı havuzu başlangıç ayarını iletmedi; koruma BEGIN READ ONLY)' "$T/log" \
  && grep -q 'işlem salt okunur=on (güvenlik kapısı)' "$T/log" && grep -q 'P toplam: AYNI=828 FARKLI=0 EKSİK=0 FAZLA=0' "$T/log" \
  || { cat "$T/log" >&2; fail "T14 (çıkış $c)"; }
clean T14; grep -q 'options=' "$T/log" && fail "T14: adres parçası günlükte"
echo "  ✓ T14 varsayılan off / işlem on (canlı #4 durumu): denetim çalıştı, 828 AYNI, yalnız bilgi notu"

sed 's/^BEGIN READ ONLY;$/BEGIN;/' "$T/r11.sql" > "$T/r15.sql"
grep -qx 'BEGIN;' "$T/r15.sql" || fail "T15 hazırlık"
PGOPTIONS='' psql "$URL" -X -q -A -t -F'|' -v ON_ERROR_STOP=1 -f "$T/r15.sql" > "$T/o15" 2> "$T/e15" || { cat "$T/e15" >&2; fail "T15 psql"; }
grep -qx 'KONTROL|off|off|[0-9]*' "$T/o15" && grep -qx 'KONTROL|DENETIM GONDERILMEDI' "$T/o15" \
  && [ "$(psql "$ADMIN" -X -At -c "select to_regclass('public.ki23_yazma_denemesi') is null")" = t ] || { cat "$T/o15" >&2; fail "T15"; }
echo "  ✓ T15 işlem salt okunur değilse (off): denetim dahil edilmedi, hiçbir şey oluşmadı"
echo "✓ KI-23 canlı denetim betiği sentetik testleri tamam (15/15)"
