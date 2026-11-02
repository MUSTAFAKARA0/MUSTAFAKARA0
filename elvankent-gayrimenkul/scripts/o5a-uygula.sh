#!/usr/bin/env bash
# =============================================================================
# O-5a UYGULAMA — supabase/ops/o5a/01…09 (9 temel migration + aynı işlemde geçmiş kaydı) canlı veritabanına, SIRAYLA.
# İş akışı: .github/workflows/elvankent-o5a-uygula.yml (yalnız sahibin tek kullanımlık tetiklemesi + taze yedek kapısı).
# Sahip onayı: "O-5a: supabase/ops/o5a altındaki 9 dosyanın sırayla canlıya uygulanmasını onaylıyorum." (02.11.2026)
#
#   O5A_DB_URL=<gizli> O5A_PAKET_SHA256=<onaylı paket özeti> bash scripts/o5a-uygula.sh
#
# Sıra (biri tutmazsa durur):
#   1 Bağlantı adresi ve parçaları maskelenir (::add-mask::); set -x yok; ham hata metni yazılmaz.
#   2 Paket bütünlüğü: dosyalar üreticiyle birebir (scripts/o5a-build.sh --check) ve 9 dosyanın sıralı SHA-256 listesinin
#     özeti iş akışında sabitlenen O5A_PAKET_SHA256 ile aynı.
#   3 Ön kontrol (salt okunur işlem, BEGIN READ ONLY): canli_sema_tespiti.sql → ilk 21 migration VAR, TUTARLILIK TAMAM, uygulanacak
#     dosyalar listenin SON kısmı (kesintiden sonra kalan yerden devam edilebilir). Hepsi zaten VAR ise hiçbir şey yapılmaz (çıkış 2).
#   4 Her eksik dosya AYRI ve TEK işlemde: BEGIN → SET LOCAL lock_timeout 10 sn, statement_timeout 300 sn → dosya (gövde + geçmiş
#     kaydı) → COMMIT. Hata → işlem kendiliğinden geri alınır, sonraki dosyaya geçilmez (çıkış 3). Her dosyadan sonra salt okunur
#     tespitte o dosya VAR olmalı.
#   5 Son kontrol (salt okunur): 30 migration VAR, karay_schema_version() = 20261011000001, postflight_v2'de yalnız 27. satır
#     (KARAYS — ayrı adım) HATA, migration geçmişinde 9 "AYNI (O-5a kaydı)". Tutmazsa çıkış 4 (uygulandı ama son kontrol temiz değil:
#     geri dönüş kararı sahibin; O5_YAYIN_PLANI Aşama 1 "Geri dönüş").
# Günlüğe yalnız: dosya adı (depodaki migration adı), durum, sayılar, güvenli hata sınıfı. Kayıt içeriği, SQL metni, adres YAZILMAZ.
# =============================================================================
set -euo pipefail
set +x
cd "$(dirname "${BASH_SOURCE[0]}")/.."
OPS=supabase/ops
say() { printf '%s\n' "$*"; if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$*" >> "$GITHUB_STEP_SUMMARY"; fi; }
die() { local code=$1; shift; say "✗ $*"; exit "$code"; }
[ -n "${O5A_DB_URL:-}" ] || die 3 "Bağlantı sırrı tanımlı değil (SUPABASE_DB_URL)"

# 1 Maskeleme
if [ "${GITHUB_ACTIONS:-}" = true ]; then
  printf '::add-mask::%s\n' "$O5A_DB_URL"
  if [[ "$O5A_DB_URL" =~ ^postgres(ql)?://([^:@/]*)(:([^@/]*))?@([^:/?]+)(:([0-9]+))?/([^?]*) ]]; then
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
[ -n "${O5A_PAKET_SHA256:-}" ] || die 2 "Onaylı paket özeti (O5A_PAKET_SHA256) verilmedi"
bash scripts/o5a-build.sh --check > /dev/null 2>&1 || die 2 "O-5a dosyaları üreticiyle aynı değil; hiçbir şey uygulanmadı"
mapfile -t FILES < <(ls "$OPS"/o5a/[0-9][0-9]_*.sql | sort)
[ "${#FILES[@]}" = 9 ] || die 2 "O-5a paketinde 9 dosya bekleniyordu (${#FILES[@]}); hiçbir şey uygulanmadı"
paket=$(for f in "${FILES[@]}"; do sha256sum "$f" | cut -d' ' -f1; done | sha256sum | cut -d' ' -f1)
[ "$paket" = "$O5A_PAKET_SHA256" ] || die 2 "O-5a paketi onaylanan sürüm değil (SHA-256 farklı); hiçbir şey uygulanmadı"
say "• O-5a paketi onaylı sürüm (9 dosya, paket SHA-256 ${paket:0:12}…), üreticiyle birebir"

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
export PGAPPNAME=karays-o5a-uygula PGCONNECT_TIMEOUT=20
export PGSSLMODE=${O5A_SSLMODE:-require}
unset PGPASSFILE PGSERVICE PGSERVICEFILE PGHOSTADDR PGOPTIONS 2> /dev/null || true

classify() { # ham hata metnini YAZMADAN güvenli sınıf
  local e=$1 code
  if grep -qiE 'password authentication failed|authentication failed|no pg_hba\.conf entry|SASL' "$e"; then echo "kimlik doğrulama başarısız"
  elif grep -qiE 'could not translate host name|Name or service not known' "$e"; then echo "ana makine adı çözülemedi"
  elif grep -qiE 'timeout expired|Connection timed out' "$e"; then echo "bağlantı zaman aşımı"
  elif grep -qiE 'Connection refused|could not connect|server closed the connection|SSL' "$e"; then echo "bağlantı kurulamadı"
  elif code=$(grep -oE '(ERROR|FATAL): +[0-9A-Z]{5}' "$e" | head -1 | grep -oE '[0-9A-Z]{5}$'); [ -n "$code" ]; then
    case "$code" in
      55P03) echo "kilit beklenmedi — tablo meşgul (SQLSTATE 55P03); işlem geri alındı, sonra tekrar denenebilir" ;;
      57014) echo "zaman aşımı (SQLSTATE 57014); işlem geri alındı" ;;
      23505) echo "tekil anahtar çakışması (SQLSTATE 23505) — örn. geçmişte bu sürüm zaten kayıtlı; işlem geri alındı" ;;
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
  psql "$O5A_DB_URL" -X -q -A -t -F'|' -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f "$T/ro.sql" > "$T/ro.out" 2> "$T/ro.err" \
    || die 3 "Salt okunur kontrol çalışmadı: $(classify "$T/ro.err")"
  ! grep -q '^KAPI|' "$T/ro.out" || die 3 "Kontrol işlemi salt okunur açılamadı; durduruldu"
}
durum() { awk -F'|' -v n="$1" '$1 == n { print $3 }' "$T/tespit"; }
tespit() { ro "$OPS/canli_sema_tespiti.sql"; cp "$T/ro.out" "$T/tespit"; }

# 3 Ön kontrol
tespit
for n in $(seq 1 21); do [ "$(durum "$n")" = VAR ] || die 2 "Ön kontrol: temel migration $n canlıda YOK — beklenen şema değil; hiçbir şey uygulanmadı"; done
grep -q '^103|TUTARLILIK|TAMAM' "$T/tespit" || die 2 "Ön kontrol: TUTARLILIK TAMAM değil (kısmi şema); hiçbir şey uygulanmadı"
pending=()
for i in "${!FILES[@]}"; do
  n=$((22 + i))
  if [ "$(durum "$n")" = YOK ]; then pending+=("${FILES[$i]}"); fi
done
[ "${#pending[@]}" -gt 0 ] || die 2 "Ön kontrol: 9 dosyanın hepsi zaten uygulanmış; hiçbir şey yapılmadı"
say "• Ön kontrol (salt okunur): 21 temel migration VAR, TUTARLILIK TAMAM; uygulanacak ${#pending[@]} dosya (zaten var: $((9 - ${#pending[@]})))"

# 4 Uygulama — her dosya ayrı, tek işlem
applied=0
for f in "${pending[@]}"; do
  ad=$(basename "$f" .sql)
  case "$f" in *"'"*|*'\'*) die 2 "Dosya yolu geçersiz" ;; esac
  cat > "$T/uygula.sql" <<SARMA
\set ON_ERROR_STOP 1
\set VERBOSITY sqlstate
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';
\i '$f'
COMMIT;
SARMA
  if ! psql "$O5A_DB_URL" -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=sqlstate -f "$T/uygula.sql" > /dev/null 2> "$T/uygula.err"; then
    say "✗ ${ad#??_}: $(classify "$T/uygula.err")"
    die 3 "Durduruldu: $applied dosya uygulandı, ${ad%%_*}. dosya ve sonrası UYGULANMADI (veritabanı son başarılı dosyadaki hâlinde)"
  fi
  n=$((10#${ad%%_*} + 21))
  tespit
  [ "$(durum "$n")" = VAR ] || die 3 "${ad#??_}: işlem bitti ama tespit VAR demiyor — durduruldu ($applied + 1 dosya uygulandı)"
  applied=$((applied + 1))
  say "  ✓ ${ad#??_} uygulandı (tek işlem; geçmiş kaydı aynı işlemde)"
done

# 5 Son kontrol
fail=0
tespit
var=$(awk -F'|' '$1 <= 30 && $3 == "VAR"' "$T/tespit" | wc -l)
surum=$(awk -F'|' '$1 == 100 { print $3 }' "$T/tespit")
ro "$OPS/postflight_v2.sql"
hata_satir=$(awk -F'|' '$4 ~ /^HATA/ { print $1 }' "$T/ro.out" | tr '\n' ' ' | sed 's/ $//')
ro "$OPS/canli_migration_gecmisi.sql"
gecmis=$(awk -F'|' '$1 == "ÖZET" && $2 == "durumlar" { print $3 }' "$T/ro.out")
say ""
say "O-5a son kontrol"
say "  migration 1–30 VAR: $var/30"
say "  karay_schema_version(): $surum"
say "  postflight_v2 HATA satırları: ${hata_satir:-yok} (beklenen yalnız 27 — KARAYS marka, ayrı adım)"
say "  migration geçmişi: $gecmis"
[ "$var" = 30 ] || fail=1
[ "$surum" = 20261011000001 ] || fail=1
[ "$hata_satir" = 27 ] || fail=1
grep -q 'AYNI (O-5a kaydı)=9' <<< "$gecmis" || fail=1
if [ "$fail" = 0 ]; then
  say "SONUÇ: TAMAM — O-5a uygulandı ($applied dosya bu çalışmada); son kontrol temiz. Sıradaki: duman testleri, ardından KARAYS marka runbook'u (ayrı onay)."
  exit 0
fi
say "SONUÇ: UYGULANDI AMA SON KONTROL TEMİZ DEĞİL — geri dönüş kararı sahibin (O5_YAYIN_PLANI Aşama 1 'Geri dönüş'); yeni işlem yapılmadı"
exit 4
