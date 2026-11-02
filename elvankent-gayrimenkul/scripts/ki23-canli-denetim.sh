#!/usr/bin/env bash
# =============================================================================
# KI-23 canlı şema ve güvenlik denetimi — GitHub Actions'ta (telefonda SQL Editor yerine) SALT OKUNUR çalıştırma.
# İş akışı: .github/workflows/elvankent-ki23-canli-denetim.yml (yalnız sahibin elle tetiklemesi).
#
#   DENETIM_DB_URL=<gizli> DENETIM_SQL_SHA256=<onaylı özet> DENETIM_TESHIS_SHA256=<onaylı özet> bash scripts/ki23-canli-denetim.sh
# Teşhis (canli_fonksiyon_teshis.sql): denetimle aynı salt okunur işlemde; fonksiyon farkını başlık / gövde / satır sonu (CR)
# bileşenlerine ayırır, yalnız SAYI yazar. Fark yalnız CRLF ise sonuç "TAMAM (biçim farkı)", değilse "BULGU VAR".
#
# Sıra (biri tutmazsa durur; çıkış kodu: 0 TAMAM · 4 bulgu var · 2 dosya/bekçi reddi · 3 bağlantı/oturum/SQL hatası):
#   1 Bağlantı adresi ve parçaları (kullanıcı, parola, ana makine, port) GitHub günlüğünde maskelenir (::add-mask::).
#   2 Denetim dosyasının SHA-256'sı iş akışında sabitlenen onaylı özetle aynı olmalı (dosya değişirse iş akışı da güncellenmeli).
#   3 scripts/ki23-denetim-guard.mjs: tek ifade, WITH … SELECT, yazma/DDL/ayar/dosya/süreç komutu yok.
#   4 Oturumun başlangıçta salt okunur açılması İSTENİR: PGOPTIONS="-c default_transaction_read_only=on …" (+ zaman aşımları);
#     Supabase havuzu bunu iletmeyebilir (canlı #4) — asıl kapı 5. adımdaki gerçek işlemdir.
#   5 TEK bağlantı, TEK işlem: BEGIN READ ONLY → aynı işlemde default_transaction_read_only ve transaction_read_only okunur →
#     transaction_read_only (GÜVENLİK KAPISI) "on" ise denetim dosyası (tek SELECT) aynı işlemde çalışır, değilse hiç dahil
#     edilmez → ROLLBACK. default_transaction_read_only yalnız bilgi (havuz PGOPTIONS'ı iletmeyebilir). Herhangi bir hata
#     (ON_ERROR_STOP) işlemi bırakır ve betik çıkış 3 ile durur. Çıktı geçici dosyaya yazılır, günlüğe YAZILMAZ.
#   6 Günlüğe ve özet sayfasına yalnız: PostgreSQL ana sürümü, G1–G4 kural başına sayı, P kategori başına AYNI/FARKLI/EKSİK/FAZLA
#     sayıları ve genel sonuç. Nesne adı, fonksiyon gövdesi, kayıt içeriği, bağlantı adresi, kimlik bilgisi YAZILMAZ.
#   7 Hata olursa ham hata metni yazılmaz; yalnız güvenli sınıf (kimlik doğrulama / bağlantı / havuz ayarı reddi / SQLSTATE).
# set -x KULLANILMAZ (komut satırları günlüğe düşmesin).
# =============================================================================
set -euo pipefail
set +x
cd "$(dirname "${BASH_SOURCE[0]}")/.."
SQL=${DENETIM_SQL:-supabase/ops/canli_sema_denetimi.sql}
# Fonksiyon farkı teşhisi (yalnız sayılar): denetimle AYNI işlemde, ardından
TESHIS=${DENETIM_TESHIS_SQL:-supabase/ops/canli_fonksiyon_teshis.sql}
say() { printf '%s\n' "$*"; if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$*" >> "$GITHUB_STEP_SUMMARY"; fi; }
die() { local code=$1; shift; say "✗ $*"; exit "$code"; }

[ -n "${DENETIM_DB_URL:-}" ] || die 3 "Bağlantı sırrı tanımlı değil (SUPABASE_DB_URL)"

# 1 Maskeleme (yalnız GitHub Actions'ta; ::add-mask:: satırları günlükte görünmez)
if [ "${GITHUB_ACTIONS:-}" = true ]; then
  printf '::add-mask::%s\n' "$DENETIM_DB_URL"
  if [[ "$DENETIM_DB_URL" =~ ^postgres(ql)?://([^:@/]*)(:([^@/]*))?@([^:/?]+)(:([0-9]+))?/([^?]*) ]]; then
    for part in "${BASH_REMATCH[2]}" "${BASH_REMATCH[4]}" "${BASH_REMATCH[5]}" "${BASH_REMATCH[7]}"; do
      if [ -n "$part" ] && [ "${#part}" -ge 3 ]; then
        printf '::add-mask::%s\n' "$part"
        dec=$(printf '%b' "${part//%/\\x}")
        if [ "$dec" != "$part" ]; then printf '::add-mask::%s\n' "$dec"; fi
      fi
    done
  fi
fi

# 2 Onaylı dosya
[ -n "${DENETIM_SQL_SHA256:-}" ] || die 2 "Onaylı denetim özeti (DENETIM_SQL_SHA256) verilmedi"
[ -f "$SQL" ] || die 2 "Denetim dosyası yok"
actual=$(sha256sum "$SQL" | cut -d' ' -f1)
[ "$actual" = "$DENETIM_SQL_SHA256" ] || die 2 "Denetim dosyası onaylanan sürüm değil (SHA-256 farklı); hiçbir şey gönderilmedi"
say "• Denetim dosyası onaylı sürüm (SHA-256 ${actual:0:12}…)"
[ -n "${DENETIM_TESHIS_SHA256:-}" ] || die 2 "Onaylı teşhis özeti (DENETIM_TESHIS_SHA256) verilmedi"
[ -f "$TESHIS" ] || die 2 "Teşhis dosyası yok"
t_actual=$(sha256sum "$TESHIS" | cut -d' ' -f1)
[ "$t_actual" = "$DENETIM_TESHIS_SHA256" ] || die 2 "Teşhis dosyası onaylanan sürüm değil (SHA-256 farklı); hiçbir şey gönderilmedi"
say "• Teşhis dosyası onaylı sürüm (SHA-256 ${t_actual:0:12}…)"

# 3 Bekçi
node scripts/ki23-denetim-guard.mjs "$SQL" > /dev/null 2>&1 || die 2 "Bekçi: dosya tek salt okunur SELECT değil; hiçbir şey gönderilmedi"
node scripts/ki23-denetim-guard.mjs "$TESHIS" > /dev/null 2>&1 || die 2 "Bekçi: teşhis dosyası tek salt okunur SELECT değil; hiçbir şey gönderilmedi"
say "• Bekçi: tek salt okunur SELECT ifadesi"

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
# 4 Salt okunur oturum (bağlantı açılırken) + zaman aşımları
export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=120000 -c lock_timeout=2000 -c idle_in_transaction_session_timeout=30000'
export PGAPPNAME=karays-ki23-salt-okunur-denetim PGCONNECT_TIMEOUT=20
export PGSSLMODE=${DENETIM_SSLMODE:-require}
unset PGPASSFILE PGSERVICE PGSERVICEFILE PGHOSTADDR 2> /dev/null || true

classify() { # ham hata metnini YAZMADAN güvenli sınıf
  local e=$1 code
  if grep -qiE 'password authentication failed|authentication failed|no pg_hba\.conf entry|SASL' "$e"; then echo "kimlik doğrulama başarısız (sır güncel mi?)"
  elif grep -qiE 'unsupported startup parameter|startup parameter|invalid command-line argument|unrecognized configuration parameter' "$e"; then
    echo "sunucu / bağlantı havuzu salt okunur başlangıç ayarını (PGOPTIONS) kabul etmedi — denetim gönderilmedi"
  elif grep -qiE 'could not translate host name|Name or service not known|nodename nor servname' "$e"; then echo "ana makine adı çözülemedi"
  elif grep -qiE 'timeout expired|Connection timed out' "$e"; then echo "bağlantı zaman aşımı"
  elif grep -qiE 'Connection refused|could not connect|server closed the connection|SSL' "$e"; then echo "bağlantı kurulamadı"
  elif code=$(grep -oE '(ERROR|FATAL): +[0-9A-Z]{5}' "$e" | head -1 | grep -oE '[0-9A-Z]{5}$'); [ -n "$code" ]; then
    case "$code" in
      25006) echo "salt okunur işlemde yazma girişimi reddedildi (SQLSTATE 25006)" ;;
      57014) echo "sorgu zaman aşımına uğradı (SQLSTATE 57014)" ;;
      55P03) echo "kilit beklenmedi (SQLSTATE 55P03)" ;;
      42501) echo "yetki yetersiz (SQLSTATE 42501)" ;;
      *) echo "SQL hatası (SQLSTATE $code)" ;;
    esac
  else echo "bilinmeyen hata (ayrıntı güvenlik nedeniyle yazılmadı)"; fi
}
# TEK BAĞLANTI, TEK İŞLEM: BEGIN READ ONLY → AYNI işlemde transaction_read_only okunur → yalnız "on" ise denetim (\i) → ROLLBACK.
# GÜVENLİK KAPISI = gerçek işlemin transaction_read_only değeri. default_transaction_read_only yalnız bilgi olarak yazılır:
# Supabase bağlantı havuzu PGOPTIONS'ı iletmeyebilir (canlı #4: default=off, işlem=on); işlem yine BEGIN READ ONLY ile salt okunurdur.
# ON_ERROR_STOP: herhangi bir hata işlemi ve bağlantıyı bırakır (çıkış 3); işlem salt okunur olduğundan hiçbir şey yazılamaz.
# Sarmalayıcı metni testte birebir kullanılır (scripts/ki23-canli-denetim-test.sh, T10/T11): işaretler arasını değiştirmeyin.
wrapper() { # $1 = denetim dosyası, $2 = (isteğe bağlı) teşhis dosyası; SHA'ları ve bekçileri yukarıda doğrulandı
# SARMALAYICI-BAS
  cat <<SARMA
\set ON_ERROR_STOP 1
\set VERBOSITY sqlstate
BEGIN READ ONLY;
SELECT current_setting('transaction_read_only') = 'on' AS ro_tamam,
       current_setting('default_transaction_read_only') AS ro_varsayilan, current_setting('server_version_num') AS surum \gset
SELECT 'KONTROL|' || :'ro_varsayilan' || '|' || current_setting('transaction_read_only') || '|' || :'surum';
\if :ro_tamam
\i '$1'
${2:+\\i '$2'}
\else
SELECT 'KONTROL|DENETIM GONDERILMEDI';
\endif
ROLLBACK;
SARMA
# SARMALAYICI-SON
}
case "$SQL$TESHIS" in *"'"*|*'\'*) die 2 "Denetim dosyası yolu geçersiz" ;; esac
wrapper "$SQL" "$TESHIS" > "$T/run.sql"
psql "$DENETIM_DB_URL" -X -q -A -t -F'|' -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f "$T/run.sql" > "$T/out" 2> "$T/err" \
  || die 3 "Denetim çalışmadı (işlem geri alındı): $(classify "$T/err")"
IFS='|' read -r tag dro tro ver < <(grep -m1 '^KONTROL|' "$T/out" || true)
[ "${tag:-}" = KONTROL ] || die 3 "Oturum kontrol satırı okunamadı; denetim sonucu kullanılmadı"
if [ "$tro" != on ] || grep -q '^KONTROL|DENETIM GONDERILMEDI' "$T/out"; then
  die 3 "İşlem salt okunur değil (transaction_read_only=$tro); denetim gönderilmedi"
fi
# Kapı geçildiyse denetim aynı işlemde çalışmış olmalı (çıktının son satırları)
grep -q '^ÖZET|P beklenen değer sayısı|' "$T/out" || die 3 "Denetim çıktısı beklenen biçimde değil"
if [ "$dro" = on ]; then dro_not="on"; else dro_not="$dro (bağlantı havuzu başlangıç ayarını iletmedi; koruma BEGIN READ ONLY)"; fi
say "• Tek bağlantı, tek işlem: BEGIN READ ONLY → işlem salt okunur=on (güvenlik kapısı) → denetim → ROLLBACK"
say "• Varsayılan salt okunur ayar (bilgi): $dro_not; PostgreSQL ana sürüm $((ver / 10000))"

# 6 Güvenli özet (yalnız sayılar)
expected=$(awk -F'|' '$1 == "ÖZET" && $2 == "P beklenen değer sayısı" { print $3 }' "$T/out")
spath=$(awk -F'|' '$1 == "ÖZET" && $2 == "search_path" { print $3 }' "$T/out")
case "$spath" in '"$user", public, extensions'|'"\$user", public, extensions') sp_ok=evet ;; *) sp_ok=hayır ;; esac
say ""
say "KI-23 canlı şema ve güvenlik denetimi"
say "search_path SQL Editor ile aynı: $sp_ok"
g_total=0
for r in G1 G2 G3 G4; do
  n=$(awk -F'|' -v r="$r" '$1 == r' "$T/out" | wc -l)
  g_total=$((g_total + n))
  case $r in
    G1) d="RLS kapalı public tablo" ;; G2) d="kiracı tablosunda koşulsuz anon/herkese okuma politikası" ;;
    G3) d="search_path'i sabit olmayan yetkili (definer) fonksiyon" ;; G4) d="RLS kapalı kiracı tablosunda anon yazma yetkisi" ;;
  esac
  say "  $r ($d): $([ "$n" = 0 ] && echo TAMAM || echo "HATA — $n nesne")"
done
say "G1–G4: $([ "$g_total" = 0 ] && echo TAMAM || echo "HATA ($g_total)")"
tot_ayni=0; tot_farkli=0; tot_eksik=0; tot_fazla=0
while IFS='|' read -r _ cat counts; do
  a=$(grep -oE 'AYNI=[0-9]+' <<< "$counts" | cut -d= -f2 || true); f=$(grep -oE 'FARKLI=[0-9]+' <<< "$counts" | cut -d= -f2 || true)
  e=$(grep -oE 'EKSİK=[0-9]+' <<< "$counts" | cut -d= -f2 || true); z=$(grep -oE 'FAZLA=[0-9]+' <<< "$counts" | cut -d= -f2 || true)
  a=${a:-0}; f=${f:-0}; e=${e:-0}; z=${z:-0}
  tot_ayni=$((tot_ayni + a)); tot_farkli=$((tot_farkli + f)); tot_eksik=$((tot_eksik + e)); tot_fazla=$((tot_fazla + z))
  if [ "$cat" = "P fonksiyon" ]; then fn_farkli=$f; fi
  say "  ${cat#P }: AYNI=$a FARKLI=$f EKSİK=$e FAZLA=$z"
done < <(awk -F'|' '$1 == "ÖZET" && $2 ~ /^P / && $2 != "P beklenen değer sayısı"' "$T/out" | sort)
if grep -q '^ÖZET|P kova|EKSİK=[0-9]*$' "$T/out"; then
  say "  not: kova satırlarının hepsi EKSİK — storage.buckets bu rolle görünmüyor olabilir (RLS); kova sonucu bu çalışmada kanıt sayılmaz"
fi
say "P toplam: AYNI=$tot_ayni FARKLI=$tot_farkli EKSİK=$tot_eksik FAZLA=$tot_fazla (beklenen nesne: $expected)"
# Fonksiyon teşhisi (yalnız sayılar)
tv() { awk -F'|' -v k="$1" '$1 == "TESHIS" && $2 == k { print $3 }' "$T/out"; }
t_bek=$(tv 'beklenen fonksiyon'); t_es=$(tv 'eşleşen imza'); t_bas=$(tv 'başlık AYNI'); t_ham=$(tv 'gövde ham AYNI')
t_cr=$(tv 'gövde CR çıkarılınca AYNI'); t_crv=$(tv 'CR içeren gövde'); t_fazla=$(tv 'beklenmeyen fonksiyon')
[ -n "$t_bek" ] && [ -n "$t_cr" ] || die 3 "Teşhis çıktısı beklenen biçimde değil"
say "Fonksiyon teşhisi: beklenen=$t_bek eşleşen imza=$t_es başlık AYNI=$t_bas gövde ham AYNI=$t_ham gövde (CR çıkarılınca) AYNI=$t_cr CR içeren gövde=$t_crv beklenmeyen=$t_fazla"
fn_aciklandi=hayır
if [ "$t_es" = "$t_bek" ] && [ "$t_bas" = "$t_bek" ] && [ "$t_cr" = "$t_bek" ] && [ "$t_fazla" = 0 ]; then
  fn_aciklandi=evet
  if [ "$t_ham" != "$t_bek" ]; then
    say "  yorum: $((t_bek - t_ham)) fonksiyonun farkı YALNIZ satır sonu biçimi (CRLF); başlıklar ve CR'siz gövdeler başvuruyla aynı"
  fi
else
  say "  yorum: fonksiyon farkı satır sonu biçimiyle AÇIKLANAMIYOR (başlık ya da gövde içeriği farklı)"
fi
fn_farkli=${fn_farkli:-0}
if [ "$g_total" = 0 ] && [ "$tot_eksik" = 0 ] && [ "$tot_fazla" = 0 ] && [ "$tot_farkli" = "$fn_farkli" ] \
   && { [ "$tot_farkli" = 0 ] || [ "$fn_aciklandi" = evet ]; } && [ $((tot_ayni + tot_farkli)) = "$expected" ]; then
  if [ "$tot_farkli" = 0 ]; then
    say "SONUÇ: TAMAM — G1–G4 temiz, $expected nesnenin hepsi AYNI"
  else
    say "SONUÇ: TAMAM (biçim farkı) — G1–G4 temiz; $((expected - tot_farkli)) nesne AYNI, $tot_farkli fonksiyonun farkı yalnız satır sonu biçimi"
  fi
  exit 0
fi
say "SONUÇ: BULGU VAR — ayrıntı (nesne adları) bu günlüğe yazılmaz; ayrı onayla incelenir"
exit 4
