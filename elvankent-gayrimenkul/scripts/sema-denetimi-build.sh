#!/usr/bin/env bash
# =============================================================================
# supabase/ops/canli_sema_denetimi.sql'in BEKLENEN değerlerini yerel başvuru veritabanından üretir (yalnız yerel; okur).
#
#   REF_DB_URL=postgresql://postgres:postgres@127.0.0.1:55322/postgres bash scripts/sema-denetimi-build.sh
#
# Başvuru: canlının uygulanmış 21 migration'ı (kesim 20261002000000) — LIVE_LIKE_SEED=… bash scripts/live-like-stack.sh start 20261002000000
# Parmak izi sorgusu dosyanın kendisinden (PARMAK-IZI-BAS … PARMAK-IZI-SON) alınır: tek kaynak.
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
: "${REF_DB_URL:?REF_DB_URL tanımlı değil (yerel başvuru veritabanı)}"
[[ "$REF_DB_URL" =~ ^postgres(ql)?://([^@/?#]*@)?(127\.0\.0\.1|localhost)(:[0-9]+)?/[A-Za-z0-9_]+$ ]] \
  || { echo "✗ YALITIM: REF_DB_URL yerel değil" >&2; exit 2; }
F=supabase/ops/canli_sema_denetimi.sql
v=$(PGOPTIONS='-c default_transaction_read_only=on' psql "$REF_DB_URL" -X -v ON_ERROR_STOP=1 -q -At -c "
select max(version) from supabase_migrations.schema_migrations")
[ "$v" = 20261001000001 ] || { echo "✗ başvuru veritabanının son migration'ı $v (beklenen 20261001000001)" >&2; exit 1; }
fpsql=$(awk '/^-- PARMAK-IZI-BAS/{f=1;next} /^-- PARMAK-IZI-SON/{f=0} f' "$F" | sed '$ s/),$/)/')
vals=$(PGOPTIONS='-c default_transaction_read_only=on' psql "$REF_DB_URL" -X -v ON_ERROR_STOP=1 -q -At -c "
with $fpsql
select string_agg(format('    (%L, %L, %L)', kategori, nesne, h), E',\n' order by kategori, nesne) from fp")
python3 - "$F" "$vals" <<'PY'
import sys, re
p, vals = sys.argv[1], sys.argv[2]
s = open(p).read()
new = "-- BEKLENEN-BAS\nexp(kategori, nesne, h) as (\n  values\n" + vals + "\n),\n-- BEKLENEN-SON"
s2, n = re.subn(r"-- BEKLENEN-BAS\n.*?-- BEKLENEN-SON", lambda m: new, s, flags=re.S)
assert n == 1
open(p, 'w').write(s2)
PY
echo "✓ $F: $(grep -c "^    ('" "$F") beklenen değer"
