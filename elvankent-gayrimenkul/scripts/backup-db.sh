#!/usr/bin/env bash
# =============================================================================
# KARAY — veritabanı yedeği (pg_dump). Gece yedek iş akışı (.github/workflows/elvankent-backup.yml)
# ve yerel geri yükleme tatbikatı AYNI betiği kullanır.
#
# Kullanım:
#   SUPABASE_DB_URL=postgresql://… [OUT_DIR=.] [STAMP=2026-10-11T0123Z] bash scripts/backup-db.sh
#
# Üretilen dosyalar (OUT_DIR içinde):
#   db-<STAMP>.dump              pg_dump --format=custom --no-owner. GRANT/REVOKE yetkileri KALIR:
#                                --no-privileges ile alınan yedek geri yüklenince sunucuya özel
#                                fonksiyonlar herkese açılır (docs/BACKUP_RESTORE.md).
#   db-<STAMP>.fingerprint.txt   kritik veri parmak izi (supabase/ops/backup_fingerprint.sql)
#   db-<STAMP>.tables.txt        tablo başına kesin satır sayısı (supabase/ops/backup_table_counts.sql)
#   db-<STAMP>.sha256            üç dosyanın SHA-256 özeti; geri yüklemeden önce: sha256sum -c db-<STAMP>.sha256
#
# Tutarlılık: parmak izi, tablo sayıları ve dump AYNI anlık görüntüden alınır
# (pg_export_snapshot + pg_dump --snapshot); yedek sırasında yazılan veri karşılaştırmayı bozmaz.
# Anlık görüntü paylaşılamazsa (ör. işlem kipindeki bağlantı havuzu) yedek yine alınır, uyarı yazılır
# ve sayılar dump'tan hemen sonra alınır. BACKUP_SHARED_SNAPSHOT=off ortak anlık görüntüyü bilerek
# kapatır (yalnızca teşhis ve tatbikat için).
#
# Log: yalnızca dosya adları ve durum yazılır. Kayıt sayısı, dosya boyutu, bağlantı adresi ve
# kullanıcı adı YAZILMAZ (herkese açık depoda Actions logları herkese açıktır).
# Gerekenler: bash, psql / pg_dump / pg_restore (sunucu sürümüyle uyumlu), sha256sum veya shasum.
# =============================================================================
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "✗ SUPABASE_DB_URL tanımlı değil" >&2
  exit 1
fi
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OPS="$HERE/../supabase/ops"
OUT_DIR=${OUT_DIR:-.}
STAMP=${STAMP:-$(date -u +%Y-%m-%dT%H%MZ)}
NAME="db-$STAMP"
# psql \o / \i argümanları tek tırnak içinde verilir; tek tırnak ve ters bölü orada özel anlam taşır
case "$OUT_DIR$STAMP" in *"'"* | *\\*) echo "✗ OUT_DIR / STAMP tek tırnak veya ters bölü (\\) içeremez" >&2; exit 1 ;; esac
mkdir -p "$OUT_DIR"
BASE="$OUT_DIR/$NAME"
ERR=$(mktemp)
snapshot=""
snap_pid=""
SNAP_DIR=""
trap 'snap_close; rm -f "$ERR"; if [ -n "$SNAP_DIR" ]; then rm -rf "$SNAP_DIR"; fi' EXIT

warn() { if [ "${GITHUB_ACTIONS:-}" = true ]; then echo "::warning title=Yedek::$1"; else echo "UYARI: $1" >&2; fi; }
# Hata çıktısında bağlantı adresi, sunucu ve kullanıcı adı gizlenir (gizli değerin tamamını GitHub zaten maskeler)
redact() { sed -E 's#postgres(ql)?://[^[:space:]"]+#<bağlantı>#g; s/(server at |host name |host |user |role |database )"[^"]*"/\1"<gizlendi>"/g'; }
fail() { echo "✗ $1" >&2; if [ -s "$ERR" ]; then redact < "$ERR" >&2; fi; exit 1; }
psql_q() { psql "$SUPABASE_DB_URL" -X -q -At -v ON_ERROR_STOP=1 "$@"; }
SESSION_SETUP=(-c 'set row_security = off' -c 'set statement_timeout = 0')

# Anlık görüntü oturumuna komut gönderir; oturum kapanmışsa betik SIGPIPE ile ölmez, hata koduyla döner
snap_send() { ( trap '' PIPE; printf '%s\n' "$@" >&3 ) 2> /dev/null; }
# Anlık görüntü oturumunu kapatır (salt okunur işlem; yazılacak bir şey yok). Her çıkışta da çalışır.
snap_close() {
  if [ -z "$snap_pid" ]; then return 0; fi
  snap_send 'rollback;' '\q' || true
  exec 3>&- 4<&-
  for _ in 1 2 3 4 5 6 7 8 9 10; do kill -0 "$snap_pid" 2> /dev/null || break; sleep 0.2; done
  kill "$snap_pid" 2> /dev/null || true
  wait "$snap_pid" 2> /dev/null || true
  snap_pid=""
}

psql_q -c 'select 1' > /dev/null 2> "$ERR" || fail "Veritabanına bağlanılamadı"

if [ "${BACKUP_SHARED_SNAPSHOT:-on}" != off ]; then
  # Anlık görüntüyü dışa aktaran oturum, pg_dump aynı görüntüyü içe aktarana kadar açık kalır (salt okunur işlem).
  # coproc yerine adlandırılmış boru: oturum erken kapansa da süreç kimliği ($!) ve tanımlayıcılar geçerli kalır
  # (bash, coproc değişkenlerini süreç bitince siler) ve betik bash 3.2'de (macOS) de çalışır.
  SNAP_DIR=$(mktemp -d)
  mkfifo "$SNAP_DIR/in" "$SNAP_DIR/out"
  psql "$SUPABASE_DB_URL" -X -q -At -v ON_ERROR_STOP=1 < "$SNAP_DIR/in" > "$SNAP_DIR/out" 2>&1 &
  snap_pid=$!
  exec 3> "$SNAP_DIR/in" 4< "$SNAP_DIR/out"
  snap_send "set idle_in_transaction_session_timeout = 0;" "set statement_timeout = 0;" "set row_security = off;" \
    "begin isolation level repeatable read read only;" "select pg_export_snapshot();" || true
  # Yanıt satırı beklenir; araya giren bildirim (NOTICE) ve hata satırları $ERR'e yazılır, oturum kapanırsa döngü biter
  while IFS= read -r -t 60 l <&4; do
    if [[ "$l" =~ ^[0-9A-F]{8}-[0-9A-F]{8}-[0-9]+$ ]]; then snapshot=$l; break; fi
    printf '%s\n' "$l" >> "$ERR"
  done
  if [ -n "$snapshot" ]; then
    : > "$ERR"
    snap_send "\\o '$BASE.fingerprint.txt'" "\\i '$OPS/backup_fingerprint.sql'" \
      "\\o '$BASE.tables.txt'" "\\i '$OPS/backup_table_counts.sql'" "\\o" "select 'KARAY-SNAPSHOT-OK';" \
      || fail "Anlık görüntü oturumu beklenmedik şekilde kapandı"
    done_ok=0
    while IFS= read -r -t 900 l <&4; do
      if [ "$l" = KARAY-SNAPSHOT-OK ]; then done_ok=1; break; fi
      printf '%s\n' "$l" >> "$ERR"
    done
    [ "$done_ok" = 1 ] || fail "Parmak izi / tablo sayıları alınamadı"
  else
    if [ -s "$ERR" ]; then redact < "$ERR" >&2; fi
    : > "$ERR"
    snap_close
    warn "Ortak anlık görüntü alınamadı (bağlantı oturum kipinde olmalı); parmak izi dump'tan hemen sonra alınacak."
  fi
fi

snap_args=()
if [ -n "$snapshot" ]; then snap_args=(--snapshot="$snapshot"); fi
pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner ${snap_args[@]+"${snap_args[@]}"} --file "$BASE.dump" 2> "$ERR" || fail "pg_dump başarısız"
if [ -s "$ERR" ]; then redact < "$ERR" >&2; fi
: > "$ERR"

if [ -n "$snapshot" ]; then
  # pg_dump görüntüyü başlangıçta içe aktardı; dışa aktaran oturum artık kapatılabilir
  snap_close
else
  psql_q "${SESSION_SETUP[@]}" -o "$BASE.fingerprint.txt" -f "$OPS/backup_fingerprint.sql" 2> "$ERR" || fail "Parmak izi alınamadı"
  psql_q "${SESSION_SETUP[@]}" -o "$BASE.tables.txt" -f "$OPS/backup_table_counts.sql" 2> "$ERR" || fail "Tablo sayıları alınamadı"
fi

# Doğrulama: dump okunabilir; parmak izi ve tablo listesi boş değil ve beklenen biçimde
pg_restore --list "$BASE.dump" > /dev/null 2> "$ERR" || fail "Dump okunamıyor (pg_restore --list)"
[ -s "$BASE.fingerprint.txt" ] || fail "Parmak izi boş"
if grep -qvE '^[0-9]+ \| [a-z_.]+ \| ([0-9]+ \| ([0-9a-f]{32}|-)|yok)$' "$BASE.fingerprint.txt"; then fail "Parmak izi beklenen biçimde değil"; fi
if grep -q ' | yok$' "$BASE.fingerprint.txt"; then warn "Parmak izinde bulunamayan tablo var (eski şema?)"; fi
[ -s "$BASE.tables.txt" ] || fail "Tablo sayıları boş"
if grep -qvE '^[^ |]+ \| [0-9]+$' "$BASE.tables.txt"; then fail "Tablo sayıları beklenen biçimde değil"; fi

if command -v sha256sum > /dev/null; then SUM=(sha256sum); else SUM=(shasum -a 256); fi
( cd "$OUT_DIR" && "${SUM[@]}" "$NAME.dump" "$NAME.fingerprint.txt" "$NAME.tables.txt" > "$NAME.sha256" )

echo "✓ Veritabanı yedeği hazır: $NAME.dump (+ .fingerprint.txt, .tables.txt, .sha256)"
if [ -n "$snapshot" ]; then
  echo "  Parmak izi ve tablo sayıları dump ile aynı anlık görüntüden alındı."
else
  echo "  Parmak izi ve tablo sayıları dump'tan hemen sonra alındı (ortak anlık görüntü yok)."
fi
