#!/usr/bin/env bash
# KARAYS · rclone günlüğünün HERKESE AÇIK özeti (yedek iş akışı, Storage adımı).
#
#   bash scripts/rclone-log-summary.sh <rclone günlük dosyası> <kova adı>
#
# Depo herkese açık olduğu için Actions günlükleri de herkese açıktır. rclone hata satırları nesne yollarını
# (organizations/<kurum kimliği>/properties/<ilan>/images/<medya>/original) içerir (Backup #43). Bu betik ham satırları
# YAZMAZ; yalnız hata türlerini sayar. Her satırda nesne yolu, UUID, 32 haneli kimlik ve adres maskelenir; dosya adı,
# kurum kimliği, ilan/medya kimliği, uç nokta ya da hesap kimliği çıktıya giremez.
set -uo pipefail

LOG=${1:?Kullanım: rclone-log-summary.sh <günlük> <kova>}
BUCKET_LABEL=${2:-?}
[ -f "$LOG" ] || { echo "$BUCKET_LABEL: rclone günlüğü yok"; exit 0; }

# Maskeleme: önce tam yol, sonra kalan kimlikler
masked=$(sed -E \
  -e 's#[^ ]*organizations/[^ :]*#<yol>#g' \
  -e 's#https?://[^ ]+#<adres>#g' \
  -e 's#[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}#<kimlik>#g' \
  -e 's#[0-9a-fA-F]{32,}#<kimlik>#g' \
  -e 's#(bucket|path) [^ :]+#\1 <ad>#g' \
  "$LOG")

errors=$(printf '%s\n' "$masked" | grep -c 'ERROR' || true)
if [ "${errors:-0}" = 0 ]; then
  echo "$BUCKET_LABEL: hata yok"
  exit 0
fi

echo "$BUCKET_LABEL: $errors hata satırı (yollar ve kimlikler gizlendi). Türler:"
# Nesne başına hatalar: "<yol>: Failed to copy: NotImplemented: Not Implemented" → "Failed to copy · NotImplemented"
printf '%s\n' "$masked" | grep 'ERROR' | sed -E \
  -e 's/^.*ERROR *: *//' \
  -e 's/^<yol>: //' \
  -e 's/(Failed to [a-z]+): ([A-Za-z]+):.*/\1 · \2/' \
  -e 's/(Attempt [0-9]+\/[0-9]+ failed with) [0-9]+ errors and: ([A-Za-z]+):.*/\1 … \2/' \
  | cut -c1-160 | sort | uniq -c | sort -rn | sed -E 's/^ *([0-9]+) (.*)$/  ×\1  \2/'
# HTTP durum kodları (sayı)
printf '%s\n' "$masked" | grep -Eo 'status code: [0-9]{3}' | sort | uniq -c | sed -E 's/^ *([0-9]+) status code: ([0-9]+)$/  HTTP \2 ×\1/'
