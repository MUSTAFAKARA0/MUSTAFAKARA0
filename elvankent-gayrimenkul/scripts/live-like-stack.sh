#!/usr/bin/env bash
# =============================================================================
# KARAY — KI-24 sentetik prova için "canlı benzeri" İKİNCİ yerel Supabase yığını (MÜŞTERİ VERİSİ YOK).
#
# Canlı veritabanında karay_schema_version() yok ve birden çok migration uygulanmamış (sahip, 01.11). Bu betik o durumu
# taklit eder: ayrı bir klasörde, ayrı proje adı ve AYRI portlarla (553xx; ana yığın 543xx) yerel bir Supabase yığını
# başlatır; yalnız KESİM tarihinden ÖNCEKİ migration'ları uygular ve depodaki demo verisini (supabase/seed.sql) yükler.
# Gerçek Supabase rolleri, auth ve storage şemaları bulunur (geri yükleme provasının ön koşulu). Hiçbir uzak sunucuya
# bağlanmaz; ana yığına dokunmaz.
#
# Kullanım:
#   bash scripts/live-like-stack.sh start [KESİM]   # varsayılan KESİM 20261010000000: karay_schema_version()'dan önce
#   bash scripts/live-like-stack.sh stop
# start sonrası: postgresql://postgres:postgres@127.0.0.1:55322/postgres (uygulama rolü),
#                postgresql://supabase_admin:postgres@127.0.0.1:55322/postgres (yerel süper kullanıcı, prova hedefi)
# SUPABASE_BIN: supabase komutu (varsayılan: supabase). LIVE_LIKE_DIR: yığın klasörü.
# LIVE_LIKE_SEED: demo verisi dosyası (varsayılan supabase/seed.sql; CI onu ana yığın başlamadan /tmp/seed.sql'e taşır).
# =============================================================================
set -euo pipefail

ACTION=${1:?Kullanım: live-like-stack.sh start [KESİM] | stop}
CUTOFF=${2:-20261010000000}
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT="$HERE/.."
DIR=${LIVE_LIKE_DIR:-${RUNNER_TEMP:-/tmp}/karay-canli-benzeri}
SB=${SUPABASE_BIN:-supabase}
SEED=${LIVE_LIKE_SEED:-$ROOT/supabase/seed.sql}

case "$ACTION" in
  stop)
    if [ -d "$DIR" ]; then (cd "$DIR" && $SB stop --no-backup > /dev/null 2>&1) || true; rm -rf "$DIR"; fi
    echo "Canlı benzeri yığın durduruldu"
    exit 0 ;;
  start) ;;
  *) echo "✗ Bilinmeyen eylem: $ACTION" >&2; exit 1 ;;
esac
[[ "$CUTOFF" =~ ^[0-9]{14}$ ]] || { echo "✗ KESİM 14 haneli olmalı" >&2; exit 1; }
[ -s "$SEED" ] || { echo "✗ Demo verisi dosyası yok: $SEED (LIVE_LIKE_SEED)" >&2; exit 1; }

rm -rf "$DIR"
mkdir -p "$DIR"
cd "$DIR"
$SB init --force > /dev/null
# Ayrı proje adı ve portlar: ana yığınla (543xx) çakışmaz
sed -i -E 's/^project_id = .*/project_id = "karay-canli-benzeri"/; s/= 543([0-9]{2})$/= 553\1/' supabase/config.toml
grep -qE '^port = 55322$' supabase/config.toml || { echo "✗ Veritabanı portu 55322'ye çevrilemedi" >&2; exit 1; }
mkdir -p supabase/migrations
n=0
for f in "$ROOT"/supabase/migrations/[0-9]*_*.sql; do
  b=$(basename "$f")
  if [[ "${b:0:14}" < "$CUTOFF" ]]; then cp "$f" supabase/migrations/; n=$((n + 1)); fi
done
total=$(find "$ROOT/supabase/migrations" -maxdepth 1 -name '[0-9]*_*.sql' | wc -l)
$SB start -x studio,imgproxy,realtime,edge-runtime,logflare,vector,supavisor > "$DIR/start.log" 2>&1 \
  || { tail -20 "$DIR/start.log" >&2; echo "✗ Canlı benzeri yığın başlatılamadı" >&2; exit 1; }
DB=postgresql://postgres:postgres@127.0.0.1:55322/postgres
PGOPTIONS='-c app.allow_demo_seed=on' psql "$DB" -X -v ON_ERROR_STOP=1 -q -f "$SEED" > /dev/null
fn=$(psql "$DB" -X -At -c "select to_regprocedure('public.karay_schema_version()') is not null")
echo "Canlı benzeri yığın hazır: $n / $total migration (kesim $CUTOFF), karay_schema_version: $([ "$fn" = t ] && echo var || echo yok), demo verisi yüklendi"
