#!/usr/bin/env bash
# =============================================================================
# O-5a kayıtlı dosyaları üretir: supabase/ops/o5a/NN_<migration>.sql (yalnız depoda dosya üretir; veritabanına bağlanmaz)
#
#   bash scripts/o5a-build.sh          # dosyaları yeniden yazar
#   bash scripts/o5a-build.sh --check  # depodaki dosyalar güncel mi (CI / birim testi O5A-01)
#
# Her dosya = migration dosyasının BİREBİR içeriği + aynı işlemde supabase_migrations.schema_migrations kaydı
# (sürüm, ad, ifadeler = dosya içeriği tek parça). SQL Editor sorguyu tek işlemde çalıştırdığı için ya ikisi birden olur ya hiçbiri.
# Sürüm zaten kayıtlıysa INSERT hata verir → dosya hiç uygulanmaz (iki kez uygulamaya karşı koruma).
# Kapsam: canlı tespitinde (01.11, KI-23) YOK çıkan 9 temel migration; KARAYS (20261018000001) kendi runbook'uyla.
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
FILES=(
  20261002000001_karay_platform.sql
  20261004000001_design_family_access.sql
  20261005000001_office_site_management.sql
  20261006000001_brand_content_draft.sql
  20261007000001_seo_draft.sql
  20261008000001_owner_invitations.sql
  20261009000001_custom_domains.sql
  20261010000001_password_reset_requests.sql
  20261011000001_customer_operations.sql
)
TAG='$o5a_dosya$'
OUT=supabase/ops/o5a
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
i=0
for f in "${FILES[@]}"; do
  i=$((i + 1))
  src="supabase/migrations/$f"
  [ -f "$src" ] || { echo "✗ $src yok" >&2; exit 1; }
  grep -qF "$TAG" "$src" && { echo "✗ $f içinde $TAG geçiyor" >&2; exit 1; }
  grep -qiE '^\s*(begin|commit|rollback|start transaction)\s*;' "$src" && { echo "✗ $f işlem komutu içeriyor" >&2; exit 1; }
  v=${f%%_*}; n=${f#*_}; n=${n%.sql}
  {
    printf -- '-- =============================================================================\n'
    printf -- '-- O-5a %d/9 · %s — SQL Editor: dosyanın TAMAMI tek sorgu (seçim yokken Run). ÜRETİLMİŞ DOSYA, elle düzenlemeyin:\n' "$i" "$f"
    printf -- '-- bash scripts/o5a-build.sh. Gövde supabase/migrations/%s ile birebir aynıdır; sonda aynı işlemde\n' "$f"
    printf -- '-- migration geçmişi kaydı vardır (sürüm zaten kayıtlıysa hata → hiçbir şey uygulanmaz).\n'
    printf -- '-- =============================================================================\n'
    cat "$src"
    printf '\n-- ---- O-5a migration geçmişi kaydı (aynı işlem) ----\n'
    printf "insert into supabase_migrations.schema_migrations (version, name, statements)\nvalues ('%s', '%s', array[%s" "$v" "$n" "$TAG"
    cat "$src"
    printf '%s]);\n' "$TAG"
  } > "$TMP/$(printf '%02d' "$i")_$f"
done
if [ "${1:-}" = --check ]; then
  diff -r "$TMP" "$OUT" > /dev/null || { echo "✗ supabase/ops/o5a güncel değil: bash scripts/o5a-build.sh" >&2; exit 1; }
  echo "✓ supabase/ops/o5a güncel (9 dosya)"
else
  rm -f "$OUT"/[0-9][0-9]_*.sql
  cp "$TMP"/*.sql "$OUT"/
  echo "✓ $OUT: 9 dosya yazıldı"
fi
