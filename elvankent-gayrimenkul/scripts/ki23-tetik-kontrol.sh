#!/usr/bin/env bash
# =============================================================================
# KI-23 canlı denetim — TEK KULLANIMLIK tetik kontrolü (veritabanına bağlanmaz; yalnız git geçmişini okur).
#
#   bash scripts/ki23-tetik-kontrol.sh <önceki_commit> <yeni_commit>     (çıkış 0 = çalıştır, 1 = çalıştırma)
#
# Kural: istek dosyasındaki "CALISTIR=evet" satırı önceki commit'te KAPALI (yok ya da "# " ile) ve yeni commit'te AÇIK olmalı.
#   kapalı → açık                  : ÇALIŞTIR (sahibin açık tetiklemesi)
#   açık → açık (başka düzenleme)  : çalıştırma — ilk çalıştırmadan sonra sıradan düzenleme yeni denetim başlatamaz
#   açık → kapalı / kapalı → kapalı: çalıştırma
#   önceki commit yok (0000…, yeni dal) : önceki KAPALI sayılır
#   önceki commit geçmişte bulunamıyor (zorla gönderim vb.): çalıştırma (güvenli taraf)
#   yeni commit önceki commit'in devamı değil (zorla gönderimle eski bir "açık" commit'e dönüş): çalıştırma
#   TETIK_SIKI=1 (canlıya yazan O-5 iş akışları): önceki commit yok (dal silinip yeniden açıldı) da çalıştırmaz
# Yeniden çalıştırmak için sahip satırı önce kapatıp (commit) sonra yeniden açar (commit). Actions'taki "Re-run" iş akışında
# ayrıca engellidir (github.run_attempt == 1).
# =============================================================================
set -euo pipefail
# İstek dosyası (depo köküne göre); başka iş akışları kendi dosyasını TETIK_DOSYA ile verir (ör. O-5a)
FILE=${TETIK_DOSYA:-elvankent-gayrimenkul/ops-requests/ki23-canli-denetim.request}
[[ "$FILE" =~ ^elvankent-gayrimenkul/ops-requests/[a-z0-9-]+\.request$ ]] || { echo "Tetik: istek dosyası yolu geçersiz — çalıştırılmadı"; exit 1; }
BEFORE=${1:-}; AFTER=${2:-}
[[ "$AFTER" =~ ^[0-9a-f]{40}$ ]] || { echo "Tetik: yeni commit kimliği geçersiz — çalıştırılmadı"; exit 1; }
[[ "$BEFORE" =~ ^[0-9a-f]{40}$ ]] || { echo "Tetik: önceki commit kimliği geçersiz — çalıştırılmadı"; exit 1; }
top=$(git rev-parse --show-toplevel)
is_open() { git -C "$top" show "$1:$FILE" 2> /dev/null | tr -d '\r' | grep -qx 'CALISTIR=evet'; }
is_open "$AFTER" || { echo "Tetik: yeni commit'te 'CALISTIR=evet' satırı açık değil — çalıştırılmadı"; exit 1; }
if [ "$BEFORE" = 0000000000000000000000000000000000000000 ]; then
  [ "${TETIK_SIKI:-}" != 1 ] || { echo "Tetik: önceki commit yok (yeni/yeniden açılmış dal) — sıkı kipte çalıştırılmadı"; exit 1; }
  before_open=hayır
elif git -C "$top" cat-file -e "$BEFORE^{commit}" 2> /dev/null; then
  git -C "$top" merge-base --is-ancestor "$BEFORE" "$AFTER" 2> /dev/null \
    || { echo "Tetik: yeni commit önceki commit'in devamı değil (zorla gönderim) — çalıştırılmadı"; exit 1; }
  if is_open "$BEFORE"; then before_open=evet; else before_open=hayır; fi
else
  echo "Tetik: önceki commit geçmişte bulunamadı — güvenli tarafta kalındı, çalıştırılmadı"; exit 1
fi
if [ "$before_open" = evet ]; then
  echo "Tetik: satır zaten açıktı (tek kullanımlık) — sıradan düzenleme yeni denetim başlatmaz. Yeniden çalıştırmak için satırı kapatıp yeniden açın."
  exit 1
fi
echo "Tetik: satır bu gönderimde kapalıdan açığa geçti — sahibin açık tetiklemesi"
