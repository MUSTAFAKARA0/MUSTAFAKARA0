#!/usr/bin/env bash
# =============================================================================
# O-5 AŞAMA 4 UYGULAMA — dört medya runbook'u canlı veritabanına, SIRAYLA (ayrı sahip onayı gerekir):
#   media_finalize_rpc (20261027000001, A) → media_privileges (20261027000002, B) → media_storage_slots (20261027000003, C)
#   → media_stray_sweep (20261031000001, D). Ön koşul: yeni medya kodu production'da (PR #4, 02.11) ve sahibin yükleme/döndürme denemesi.
# İş akışı: .github/workflows/elvankent-o5c-uygula.yml (yalnız sahibin tek kullanımlık tetiklemesi + taze yedek kapısı).
#
#   O5C_DB_URL=<gizli> O5C_PAKET_SHA256=<onaylı paket özeti> bash scripts/o5c-uygula.sh
#
# Sıra (biri tutmazsa durur):
#   1 Bağlantı adresi ve parçaları maskelenir; set -x yok; ham hata metni yazılmaz.
#   2 Paket bütünlüğü: dört runbook'un 01/03/03b/04 dosyalarının sıralı SHA-256 listesinin özeti = O5C_PAKET_SHA256.
#   3 Ön kontrol (salt okunur işlem): tespit 1–35 VAR (O-5a + KARAYS + Aşama 3), TUTARLILIK TAMAM, karay_schema_version() =
#     20261018000001; uygulanacak medya runbook'ları (36–39) dördün SON kısmı (kesintiden sonra kalan yerden devam).
#   4 Her eksik runbook: 01 (salt okunur işlemde; DUR yok — DUR'da 20 sn arayla en çok 3 deneme) → 03 (kendi tek işlemi: lock_timeout 3 sn, gövde, aynı işlemde kontrol;
#     kilit beklenemezse 55P03 → hiçbir şey değişmez, 20 sn sonra en çok 3 kez yeniden denenir) → company_name için 03b (NOT VALID
#     kısıtı doğrular; isteğe bağlı: hata verirse uyarı, kısıt doğrulanmamış kalır) → 04 (salt okunur; DUR/HATA yok) → tespit VAR.
#     02 (geri dönüş durumu) çalıştırılmaz: içinde fonksiyon tanımları var, günlüğe yazılmaz; geri dönüş kaynağı taze yedek + 05.
#   5 Son kontrol (salt okunur): 1–39 VAR, sürüm 20261018000001 (değişmez), postflight_v2 HATA yok,
#     enforce_subscription_limits = false (bayrak KAPALI), migration geçmişi değişmedi (31 kayıt; bekleyen dosyalar kayıt yazmaz).
#     Tutmazsa çıkış 4 (geri dönüş kararı sahibin: runbook'ların 05_rollback.sql'i ters sırayla: D → C → B → A).
# Günlüğe yalnız: runbook adı, durum, sayılar, güvenli hata sınıfı, DUR/HATA satırlarının kontrol adı. SQL metni, adres YAZILMAZ.
# Çıkış: 0 tamam · 2 hiçbir şey yapılmadı (paket/ön kontrol/zaten uygulanmış) · 3 durduruldu (yarıda; şema son başarılı adımda)
#        · 4 uygulandı ama son kontrol temiz değil.
# =============================================================================
set -euo pipefail
set +x
cd "$(dirname "${BASH_SOURCE[0]}")/.."
OPS=supabase/ops
RUNBOOKS=(media_finalize_rpc media_privileges media_storage_slots media_stray_sweep)
say() { printf '%s\n' "$*"; if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$*" >> "$GITHUB_STEP_SUMMARY"; fi; }
die() { local code=$1; shift; say "✗ $*"; exit "$code"; }
[ -n "${O5C_DB_URL:-}" ] || die 3 "Bağlantı sırrı tanımlı değil (SUPABASE_DB_URL)"

# 1 Maskeleme
if [ "${GITHUB_ACTIONS:-}" = true ]; then
  printf '::add-mask::%s\n' "$O5C_DB_URL"
  if [[ "$O5C_DB_URL" =~ ^postgres(ql)?://([^:@/]*)(:([^@/]*))?@([^:/?]+)(:([0-9]+))?/([^?]*) ]]; then
    for part in "${BASH_REMATCH[2]}" "${BASH_REMATCH[4]}" "${BASH_REMATCH[5]}" "${BASH_REMATCH[7]}"; do
      if [ -n "$part" ] && [ "${#part}" -ge 3 ]; then
        printf '::add-mask::%s\n' "$part"
        dec=$(printf '%b' "${part//%/\\x}")
        if [ "$dec" != "$part" ]; then printf '::add-mask::%s\n' "$dec"; fi
      fi
    done
  fi
fi

# 2 Paket bütünlüğü
paket_dosyalari() { for rb in "${RUNBOOKS[@]}"; do ls "$OPS/$rb"/0[134]*.sql; done; }
[ -n "${O5C_PAKET_SHA256:-}" ] || die 2 "Onaylı paket özeti (O5C_PAKET_SHA256) verilmedi"
paket=$(paket_dosyalari | while read -r f; do sha256sum "$f" | cut -d' ' -f1; done | sha256sum | cut -d' ' -f1)
[ "$paket" = "$O5C_PAKET_SHA256" ] || die 2 "Aşama 4 paketi onaylanan sürüm değil (SHA-256 farklı); hiçbir şey uygulanmadı"
say "• Aşama 4 paketi onaylı sürüm ($(paket_dosyalari | wc -l) dosya, paket SHA-256 ${paket:0:12}…)"

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
export PGAPPNAME=karays-o5c-uygula PGCONNECT_TIMEOUT=20
export PGSSLMODE=${O5C_SSLMODE:-require}
unset PGPASSFILE PGSERVICE PGSERVICEFILE PGHOSTADDR PGOPTIONS 2> /dev/null || true

classify() { # ham hata metnini YAZMADAN güvenli sınıf
  local e=$1 code
  if grep -qiE 'password authentication failed|authentication failed|no pg_hba\.conf entry|SASL' "$e"; then echo "kimlik doğrulama başarısız"
  elif grep -qiE 'could not translate host name|Name or service not known' "$e"; then echo "ana makine adı çözülemedi"
  elif grep -qiE 'timeout expired|Connection timed out' "$e"; then echo "bağlantı zaman aşımı"
  elif grep -qiE 'Connection refused|could not connect|server closed the connection|SSL' "$e"; then echo "bağlantı kurulamadı"
  elif code=$(grep -oE '(ERROR|FATAL): +[0-9A-Z]{5}' "$e" | head -1 | grep -oE '[0-9A-Z]{5}$'); [ -n "$code" ]; then
    case "$code" in
      55P03) echo "kilit beklenmedi — tablo meşgul (SQLSTATE 55P03); işlem geri alındı" ;;
      57014) echo "zaman aşımı (SQLSTATE 57014); işlem geri alındı" ;;
      P0001) echo "betiğin koruma/kontrol bloğu durdurdu (SQLSTATE P0001); işlem geri alındı" ;;
      42501) echo "yetki yetersiz (SQLSTATE 42501); işlem geri alındı" ;;
      *) echo "SQL hatası (SQLSTATE $code); işlem geri alındı" ;;
    esac
  else echo "bilinmeyen hata (ayrıntı güvenlik nedeniyle yazılmadı)"; fi
}
ro() { # salt okunur işlemde bir denetim dosyası: BEGIN READ ONLY → kapı → dosya → ROLLBACK
  cat > "$T/ro.sql" <<SARMA
\set ON_ERROR_STOP 1
\set VERBOSITY sqlstate
BEGIN READ ONLY;
SELECT current_setting('transaction_read_only') = 'on' AS ro_tamam \gset
\if :ro_tamam
\i '$1'
\else
SELECT 'KAPI|SALT OKUNUR DEĞİL';
\endif
ROLLBACK;
SARMA
  psql "$O5C_DB_URL" -X -q -A -t -F'|' -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f "$T/ro.sql" > "$T/ro.out" 2> "$T/ro.err" \
    || die 3 "Salt okunur kontrol çalışmadı: $(classify "$T/ro.err")"
  ! grep -q '^KAPI|' "$T/ro.out" || die 3 "Kontrol işlemi salt okunur açılamadı; durduruldu"
}
# DUR/HATA satırlarının yalnız kontrol adı (2. sütun); değer sütunu yazılmaz
bulgu() { grep -E "\|($1)" "$T/ro.out" | awk -F'|' '{ print $2 }' | head -5 | sed 's/^/      · /' || true; }
durum() { awk -F'|' -v n="$1" '$1 == n { print $3 }' "$T/tespit"; }
tespit() { ro "$OPS/canli_sema_tespiti.sql"; cp "$T/ro.out" "$T/tespit"; }
apply() { # $1 dosya; 55P03'te 20 sn arayla en çok 3 deneme
  local f=$1 n
  for n in 1 2 3; do
    if psql "$O5C_DB_URL" -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f "$f" > /dev/null 2> "$T/uygula.err"; then return 0; fi
    grep -qE '(ERROR|FATAL): +55P03' "$T/uygula.err" || return 1
    [ "$n" = 3 ] && return 1
    say "    · tablo meşgul (55P03), hiçbir şey değişmedi; 20 sn sonra yeniden denenecek ($n/3)"
    sleep "${O5C_BEKLE_SN:-20}"
  done
}

# 3 Ön kontrol
tespit
for n in $(seq 1 35); do [ "$(durum "$n")" = VAR ] || die 2 "Ön kontrol: migration $n canlıda YOK — Aşama 3 sonrası şema değil; hiçbir şey uygulanmadı"; done
grep -q '^103|TUTARLILIK|TAMAM' "$T/tespit" || die 2 "Ön kontrol: TUTARLILIK TAMAM değil (kısmi şema); hiçbir şey uygulanmadı"
[ "$(awk -F'|' '$1 == 100 { print $3 }' "$T/tespit")" = 20261018000001 ] || die 2 "Ön kontrol: karay_schema_version() 20261018000001 değil; hiçbir şey uygulanmadı"
pending=(); goruldu=0
for i in "${!RUNBOOKS[@]}"; do
  if [ "$(durum $((36 + i)))" = YOK ]; then pending+=("$i"); goruldu=1
  elif [ "$goruldu" = 1 ]; then die 2 "Ön kontrol: ${RUNBOOKS[$i]} uygulanmış ama öncekilerden biri değil (sıra bozuk); hiçbir şey uygulanmadı"; fi
done
[ "${#pending[@]}" -gt 0 ] || die 2 "Ön kontrol: dört runbook'un hepsi zaten uygulanmış; hiçbir şey yapılmadı"
say "• Ön kontrol (salt okunur): 35 migration VAR, TUTARLILIK TAMAM, sürüm 20261018000001; uygulanacak ${#pending[@]} runbook (zaten var: $((4 - ${#pending[@]})))"

# 4 Uygulama
applied=0
for i in "${pending[@]}"; do
  rb=${RUNBOOKS[$i]}
  for n in 1 2 3; do # 01 kilit kuyruğu / uzun işlem görürse DUR der: salt okunur, beklenip yeniden denenir
    ro "$OPS/$rb/01_preflight.sql"
    grep -qE '\|DUR' "$T/ro.out" || break
    if [ "$n" = 3 ]; then
      say "✗ $rb: 01 ön kontrolde DUR var (3 denemede):"; bulgu DUR
      die 3 "Durduruldu: $applied runbook uygulandı, $rb ve sonrası UYGULANMADI"
    fi
    say "    · $rb 01 ön kontrolde DUR (ör. tablo meşgul):"; bulgu DUR
    say "    · hiçbir şey değişmedi; ${O5C_BEKLE_SN:-20} sn sonra yeniden denenecek ($n/3)"
    sleep "${O5C_BEKLE_SN:-20}"
  done
  if ! apply "$OPS/$rb/03_apply.sql"; then
    say "✗ $rb: $(classify "$T/uygula.err")"
    die 3 "Durduruldu: $applied runbook uygulandı, $rb ve sonrası UYGULANMADI (veritabanı son başarılı runbook'taki hâlinde)"
  fi
  ek=""
  if [ -f "$OPS/$rb/03b_validate.sql" ]; then
    if apply "$OPS/$rb/03b_validate.sql"; then ek=" + 03b doğrulandı"
    else ek=" (03b doğrulanamadı: $(classify "$T/uygula.err") — isteğe bağlı, kısıt yeni satırları yine denetler)"; fi
  fi
  ro "$OPS/$rb/04_postflight.sql"
  if grep -qE '\|(DUR|HATA)' "$T/ro.out"; then
    say "✗ $rb: 03 uygulandı ama 04 son kontrolde DUR/HATA var:"; bulgu 'DUR|HATA'
    die 4 "Durduruldu: $rb uygulandı ama son kontrolü temiz değil; sonraki runbook'lar UYGULANMADI (geri dönüş kararı sahibin)"
  fi
  tespit
  [ "$(durum $((36 + i)))" = VAR ] || die 4 "$rb: 03 ve 04 bitti ama tespit VAR demiyor — durduruldu"
  applied=$((applied + 1))
  say "  ✓ $rb: 01 DUR yok · 03 uygulandı (tek işlem)$ek · 04 DUR/HATA yok"
done

# 5 Son kontrol
fail=0
tespit
var=$(awk -F'|' '$1 <= 39 && $3 == "VAR"' "$T/tespit" | wc -l)
surum=$(awk -F'|' '$1 == 100 { print $3 }' "$T/tespit")
ro "$OPS/postflight_v2.sql"
hata_satir=$(awk -F'|' '$4 ~ /^HATA/ { print $1 }' "$T/ro.out" | tr '\n' ' ' | sed 's/ $//')
cat > "$T/bayrak.sql" <<'SQL'
select 'BAYRAK|' || coalesce((select string_agg(enforce_subscription_limits::text, ',') from public.platform_settings), 'yok');
SQL
ro "$T/bayrak.sql"
bayrak=$(awk -F'|' '$1 == "BAYRAK" { print $2 }' "$T/ro.out")
ro "$OPS/canli_migration_gecmisi.sql"
gecmis=$(awk -F'|' '$1 == "ÖZET" && $2 == "durumlar" { print $3 }' "$T/ro.out")
kayit=$(awk -F'|' '$1 == "ÖZET" && $2 == "kayıt defteri" { print $3 }' "$T/ro.out")
say ""
say "Aşama 4 son kontrol"
say "  migration 1–39 VAR: $var/39"
say "  karay_schema_version(): $surum (değişmemeli)"
say "  postflight_v2 HATA satırları: ${hata_satir:-yok}"
say "  enforce_subscription_limits: ${bayrak:-okunamadı} (KAPALI = false olmalı)"
say "  migration geçmişi: $kayit · $gecmis"
[ "$var" = 39 ] || fail=1
[ "$surum" = 20261018000001 ] || fail=1
[ -z "$hata_satir" ] || fail=1
[ "$bayrak" = false ] || fail=1
grep -q '^31 kayıt' <<< "$kayit" || fail=1
if [ "$fail" = 0 ]; then
  say "SONUÇ: TAMAM — Aşama 4 uygulandı ($applied runbook bu çalışmada); bayrak KAPALI, son kontrol temiz. Sıradaki: duman testi (fotoğraf yükleme, döndürme, silme)."
  exit 0
fi
say "SONUÇ: UYGULANDI AMA SON KONTROL TEMİZ DEĞİL — geri dönüş kararı sahibin (runbook'ların 05_rollback.sql'i ters sırayla: D → C → B → A); yeni işlem yapılmadı"
exit 4
