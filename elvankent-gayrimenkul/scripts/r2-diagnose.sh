#!/usr/bin/env bash
# KARAYS · Cloudflare R2 bağlantı teşhisi (Backup #41: ilk aktarımda 400 Bad Request; önceki denemede 403 Forbidden).
#
# Yedek iş akışıyla AYNI sırları/değişkenleri kullanır, yeni anahtar istemez:
#   BACKUP_S3_ENDPOINT, BACKUP_S3_REGION, BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY (secrets)
#   BACKUP_BUCKET, BACKUP_S3_PROVIDER (variables)   ·   RUN_TAG: benzersiz ek (iş akışı: run id + deneme)
#
# Aşamalar (biri başarısız olursa sonrakiler çalışmaz; hangi aşamada durduğu ve GÜVENLİ hata kategorisi yazılır):
#   0 ayarlar   değerlerin BİÇİMİ (değerlerin kendisi yazılmaz): boşluk, https, R2 alan adı, yol, bölge, anahtar uzunlukları
#   1 erişim    kovaya erişim: yalnız diagnostics/ önekinde listeleme (rclone = yedeğin istemcisi; aws cli = ikinci görüş)
#   2 yükleme   diagnostics/r2-test-<RUN_TAG>-<rastgele>.txt (kişisel veri yok); önceden VAR OLMADIĞI denetlenir
#   3 okuma     dosya geri okunur, SHA-256 karşılaştırılır
#   4 silme     YALNIZ bu dosya silinir (deletefile, tam anahtar) ve yokluğu denetlenir
# Hiçbir aşama başka bir nesneyi değiştirmez ya da silmez (sync/delete/purge/move yok). Başarısızlıkta test dosyası
# silinmeye çalışılır; kalırsa yalnız NESNE ANAHTARI raporlanır.
# Log'a anahtar, gizli anahtar, uç nokta adresi, hesap kimliği ya da ham hata metni YAZILMAZ: ham çıktı yalnız sınıflandırılır.
set -uo pipefail

SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/null}
RUN_TAG=${RUN_TAG:-local}
STAGE=""
FAILED=0
KEY=""
UPLOADED=0
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

say() { printf '%s\n' "$*"; }
row() { printf '| %s | %s | %s |\n' "$1" "$2" "$3" >> "$SUMMARY"; say "AŞAMA $1: $2 — $3"; }
annotate() { say "::error title=R2 teşhisi: aşama $1 başarısız::$2"; }

# Ham istemci çıktısından güvenli kategori (metnin kendisi yazılmaz)
classify() { # dosya
  local f="$1"
  if grep -Eq 'access key has length ([0-9]+), should be 32' "$f"; then
    printf 'erisim_anahtari_uzunlugu (%s karakter, beklenen 32: Cloudflare API token değil, R2 "Access Key ID" girilmeli)' \
      "$(grep -Eo 'access key has length [0-9]+' "$f" | grep -Eo '[0-9]+$' | head -1)"
  elif grep -Eq 'SignatureDoesNotMatch' "$f"; then printf 'imza_uyusmuyor (gizli anahtar yanlış ya da başında/sonunda boşluk)'
  elif grep -Eq 'InvalidAccessKeyId' "$f"; then printf 'erisim_anahtari_gecersiz (anahtar yok ya da iptal edilmiş)'
  elif grep -Eq 'AccessDenied|status code: 403|\(403\)|403 Forbidden|Forbidden' "$f"; then printf 'yetki_reddedildi (anahtar bu kovaya yetkili değil: token kapsamı / Object Read & Write)'
  elif grep -Eq 'NoSuchBucket|status code: 404|\(404\)|directory not found' "$f"; then printf 'kova_bulunamadi (kova adı ya da yargı bölgesi uç noktası: AB kovası için .eu. uç noktası)'
  elif grep -Eq 'InvalidRegionName|AuthorizationHeaderMalformed|region' "$f" && grep -Eq '400|Bad Request|InvalidRegion|Malformed' "$f"; then printf 'bolge_gecersiz (R2 için bölge "auto")'
  elif grep -Eq 'InvalidArgument|InvalidRequest|status code: 400|\(400\)|BadRequest|Bad Request' "$f"; then printf 'istek_gecersiz (400: bölge, uç nokta biçimi ya da anahtar biçimi)'
  elif grep -Eq 'no such host|lookup |dial tcp|i/o timeout|connection refused|connection reset|x509|TLS|tls:' "$f"; then printf 'ag_baglanti (DNS/TLS/bağlantı: uç nokta adresi)'
  elif grep -Eq 'Could not connect|EndpointConnectionError' "$f"; then printf 'ag_baglanti (uç noktaya bağlanılamadı)'
  else printf 'bilinmeyen (ham çıktı güvenlik gereği yazılmadı)'
  fi
}

fail() { # aşama mesaj
  FAILED=1
  row "$1" "HATA" "$2"
  annotate "$1" "$2"
}

finish() {
  if [ "$UPLOADED" = 1 ] && [ -n "$KEY" ]; then
    # Başarısızlıkta test dosyasını kaldırmayı dene (yalnız bu anahtar)
    if rclone deletefile "diag:$BACKUP_BUCKET/$KEY" --s3-no-check-bucket >"$WORK/cleanup.out" 2>&1; then
      say "Temizlik: test dosyası silindi."
    else
      say "::warning title=R2 teşhisi: test dosyası kaldı::Nesne anahtarı: $KEY (yalnız bu dosya; elle silinebilir)"
      printf '\n**Kalan test dosyası (yalnız nesne anahtarı):** `%s`\n' "$KEY" >> "$SUMMARY"
    fi
  fi
  if [ "$FAILED" = 1 ]; then
    printf '\nSonuç: **%s** aşamasında durdu.\n' "$STAGE" >> "$SUMMARY"
    say "SONUÇ: $STAGE aşamasında durdu"
    exit 1
  fi
  printf '\nSonuç: **TAMAM** — bağlantı, yükleme, okuma ve silme çalışıyor.\n' >> "$SUMMARY"
  say "SONUÇ: TAMAM"
  exit 0
}

{
  printf '### R2 bağlantı teşhisi\n\n'
  printf '| Aşama | Durum | Ayrıntı (güvenli) |\n|---|---|---|\n'
} >> "$SUMMARY"

# --- 0 ayarlar ----------------------------------------------------------------------------------------------------
STAGE="0 ayarlar"
problems=()
for name in BACKUP_S3_ENDPOINT BACKUP_S3_REGION BACKUP_S3_ACCESS_KEY_ID BACKUP_S3_SECRET_ACCESS_KEY BACKUP_BUCKET; do
  v="${!name:-}"
  if [ -z "$v" ]; then problems+=("$name tanımlı değil"); continue; fi
  [ "$v" = "$(printf '%s' "$v" | tr -d '[:space:]')" ] || problems+=("$name boşluk ya da satır sonu içeriyor (kopyalarken eklenmiş olabilir)")
done
ep="${BACKUP_S3_ENDPOINT:-}"
if [ -n "$ep" ]; then
  case "$ep" in https://*) ;; *) problems+=("BACKUP_S3_ENDPOINT https:// ile başlamıyor") ;; esac
  rest="${ep#https://}"; host="${rest%%/*}"; path="${rest#"$host"}"
  if [[ "$host" =~ ^[0-9a-f]{32}\.(eu\.|fedramp\.)?r2\.cloudflarestorage\.com$ ]]; then
    if [[ "$host" == *.eu.r2.cloudflarestorage.com ]]; then jur="AB (eu)"; elif [[ "$host" == *.fedramp.* ]]; then jur="fedramp"; else jur="varsayılan"; fi
  else
    jur="?"
    problems+=("BACKUP_S3_ENDPOINT biçimi R2 değil (beklenen https://<32 haneli hesap kimliği>.r2.cloudflarestorage.com; AB kovası için .eu.)")
  fi
  if [ -n "$path" ] && [ "$path" != "/" ]; then problems+=("BACKUP_S3_ENDPOINT sonunda yol var (kova adı uç noktaya yazılmamalı; yalnız alan adı)"); fi
fi
reg="${BACKUP_S3_REGION:-}"
if [ -n "$reg" ] && [ "$reg" != "auto" ] && [ "$reg" != "us-east-1" ]; then problems+=("BACKUP_S3_REGION R2 için geçerli değil (beklenen: auto)"); fi
ak="${BACKUP_S3_ACCESS_KEY_ID:-}"
if [ -n "$ak" ] && ! [[ "$ak" =~ ^[0-9a-f]{32}$ ]]; then problems+=("BACKUP_S3_ACCESS_KEY_ID R2 biçiminde değil (${#ak} karakter; beklenen 32 küçük harf onaltılık — Cloudflare API token değil, R2 Access Key ID)"); fi
sk="${BACKUP_S3_SECRET_ACCESS_KEY:-}"
if [ -n "$sk" ] && ! [[ "$sk" =~ ^[0-9a-f]{64}$ ]]; then problems+=("BACKUP_S3_SECRET_ACCESS_KEY R2 biçiminde değil (${#sk} karakter; beklenen 64 küçük harf onaltılık)"); fi
bk="${BACKUP_BUCKET:-}"
if [ -n "$bk" ] && ! [[ "$bk" =~ ^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$ ]]; then problems+=("BACKUP_BUCKET kova adı biçiminde değil (yalnız küçük harf, rakam, tire; 3–63 karakter; / içermez)"); fi
prov="${BACKUP_S3_PROVIDER:-Other}"
[ "$prov" = "Cloudflare" ] || problems+=("BACKUP_S3_PROVIDER '$prov' (R2 için önerilen: Cloudflare)")
if [ ${#problems[@]} -gt 0 ]; then
  fail "$STAGE" "$(IFS='; '; printf '%s' "${problems[*]}")"
  finish
fi
row "$STAGE" "TAMAM" "biçimler R2 ile uyumlu · yargı bölgesi: ${jur:-?} · bölge geçerli · sağlayıcı: $prov"

export RCLONE_CONFIG_DIAG_TYPE=s3
export RCLONE_CONFIG_DIAG_PROVIDER="$prov"
export RCLONE_CONFIG_DIAG_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_DIAG_REGION="$BACKUP_S3_REGION"
export RCLONE_CONFIG_DIAG_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_DIAG_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY"
rv=$(rclone version 2>/dev/null | head -1 | grep -Eo 'v[0-9]+\.[0-9]+(\.[0-9]+)?' || true)
say "rclone sürümü: ${rv:-bilinmiyor}"

aws_s3() { # aws cli, yalnız bu komut için kimlik bilgileri; R2 ile uyum için sağlama toplamı yalnız gerektiğinde
  AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION="$BACKUP_S3_REGION" \
  AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required AWS_EC2_METADATA_DISABLED=true \
  AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null \
    aws --endpoint-url "$BACKUP_S3_ENDPOINT" --no-cli-pager --output json s3api "$@"
}

# --- 1 erişim -----------------------------------------------------------------------------------------------------
STAGE="1 erişim"
rclone_ok=0; aws_note="aws cli yok"
if rclone lsf "diag:$BACKUP_BUCKET/diagnostics/" --s3-no-check-bucket --max-depth 1 >"$WORK/list.out" 2>&1; then rclone_ok=1; fi
if command -v aws >/dev/null 2>&1; then
  if aws_s3 list-objects-v2 --bucket "$BACKUP_BUCKET" --prefix diagnostics/ --max-keys 1 >"$WORK/aws.out" 2>&1; then aws_note="aws cli: erişim TAMAM"
  else aws_note="aws cli: $(classify "$WORK/aws.out")"; fi
fi
if [ "$rclone_ok" != 1 ]; then
  fail "$STAGE" "rclone ${rv:-?}: $(classify "$WORK/list.out") · $aws_note"
  finish
fi
row "$STAGE" "TAMAM" "rclone ${rv:-?}: diagnostics/ listelendi · $aws_note"

# --- 2 yükleme ----------------------------------------------------------------------------------------------------
STAGE="2 yükleme"
KEY="diagnostics/r2-test-${RUN_TAG}-$(od -An -N6 -tx1 /dev/urandom | tr -d ' \n').txt"
printf 'KARAYS R2 baglanti testi\nrun: %s\nutc: %s\nKisisel veri icermez; teshis sonunda silinir.\n' "$RUN_TAG" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$WORK/test.txt"
want=$(sha256sum "$WORK/test.txt" | cut -d' ' -f1)
# Var olan bir nesnenin üzerine asla yazılmaz
if rclone lsf "diag:$BACKUP_BUCKET/$KEY" --s3-no-check-bucket >"$WORK/exists.out" 2>&1 && [ -s "$WORK/exists.out" ]; then
  KEY_EXISTING=1
else
  KEY_EXISTING=0
fi
if [ "$KEY_EXISTING" = 1 ]; then
  KEY=""  # başkasının nesnesi: dokunulmaz
  fail "$STAGE" "benzersiz test anahtarı zaten var (çakışma); hiçbir şey yazılmadı, yeniden çalıştırın"
  finish
fi
if ! rclone copyto "$WORK/test.txt" "diag:$BACKUP_BUCKET/$KEY" --s3-no-check-bucket >"$WORK/put.out" 2>&1; then
  # Yükleme başarısızsa yine de nesne oluşmuş olabilir: temizlik dener
  UPLOADED=1
  fail "$STAGE" "rclone ${rv:-?}: $(classify "$WORK/put.out")"
  finish
fi
UPLOADED=1
row "$STAGE" "TAMAM" "test dosyası yüklendi: $KEY"

# --- 3 okuma ------------------------------------------------------------------------------------------------------
STAGE="3 okuma"
if ! rclone cat "diag:$BACKUP_BUCKET/$KEY" --s3-no-check-bucket >"$WORK/back.txt" 2>"$WORK/get.out"; then
  fail "$STAGE" "rclone ${rv:-?}: $(classify "$WORK/get.out")"
  finish
fi
got=$(sha256sum "$WORK/back.txt" | cut -d' ' -f1)
if [ "$got" != "$want" ]; then
  fail "$STAGE" "geri okunan içerik farklı (SHA-256 uyuşmuyor)"
  finish
fi
row "$STAGE" "TAMAM" "geri okundu, SHA-256 aynı"

# --- 4 silme ------------------------------------------------------------------------------------------------------
STAGE="4 silme"
if ! rclone deletefile "diag:$BACKUP_BUCKET/$KEY" --s3-no-check-bucket >"$WORK/del.out" 2>&1; then
  fail "$STAGE" "rclone ${rv:-?}: $(classify "$WORK/del.out")"
  finish
fi
if rclone lsf "diag:$BACKUP_BUCKET/$KEY" --s3-no-check-bucket >"$WORK/gone.out" 2>&1 && [ -s "$WORK/gone.out" ]; then
  fail "$STAGE" "silindi denildi ama nesne hâlâ listeleniyor"
  finish
fi
UPLOADED=0
row "$STAGE" "TAMAM" "yalnız test dosyası silindi, artık yok"
STAGE="tamam"
finish
