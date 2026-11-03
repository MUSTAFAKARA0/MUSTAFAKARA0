#!/usr/bin/env bash
# =============================================================================
# O-5 canlı yazma iş akışları — BU COMMIT İÇİN TEK KOŞU kontrolü (veritabanına bağlanmaz).
#
#   curl …/actions/workflows/<iş akışı>/runs?head_sha=<sha>&per_page=100 | bash scripts/o5-tek-kullanim.sh <run_id> <sha>
#   (çıkış 0 = bu commit için başka koşu yok, 1 = çalıştırma)
#
# Aynı istek commit'i ikinci kez kullanılamaz: aynı iş akışının aynı commit için (durumu ne olursa olsun: başarılı,
# başarısız, iptal, atlanmış, sırada) BAŞKA bir koşusu varsa durur. Böylece eski bir "açık" commit'in zorla yeniden
# gönderilmesi, Re-run dışı yeniden başlatmalar ve aynı commit'e ikinci tetik reddedilir. Okunamayan/bozuk yanıt → çalıştırma.
# =============================================================================
set -euo pipefail
RUN_ID=${1:-}; SHA=${2:-}
[[ "$RUN_ID" =~ ^[0-9]+$ ]] || { echo "Tek kullanım: koşu kimliği geçersiz — çalıştırılmadı"; exit 1; }
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "Tek kullanım: commit kimliği geçersiz — çalıştırılmadı"; exit 1; }
RUN_ID="$RUN_ID" SHA="$SHA" python3 -c '
import json, os, sys
try:
    d = json.load(sys.stdin)
    runs = d["workflow_runs"]
    total = int(d["total_count"])
except Exception:
    print("Tek kullanım: koşu listesi okunamadı — güvenli tarafta kalındı, çalıştırılmadı"); sys.exit(1)
rid, sha = int(os.environ["RUN_ID"]), os.environ["SHA"]
if total > len(runs):
    print("Tek kullanım: koşu listesi eksik — güvenli tarafta kalındı, çalıştırılmadı"); sys.exit(1)
if not any(r.get("id") == rid for r in runs):
    print("Tek kullanım: bu koşu listede yok — güvenli tarafta kalındı, çalıştırılmadı"); sys.exit(1)
other = [r for r in runs if r.get("head_sha") == sha and r.get("id") != rid]
if other:
    print(f"Tek kullanım: bu commit için daha önce {len(other)} koşu var — istek ikinci kez kullanılamaz. Satırı kapatıp yeniden açın."); sys.exit(1)
print("Tek kullanım: bu commit için ilk koşu")
'
