#!/usr/bin/env bash
# =============================================================================
# KI-23 canlı denetim provası (yalnız YEREL): canlı veritabanının kuruluş yolunu taklit eder ve dört salt okunur denetimin
# (canli_sema_tespiti, canli_migration_gecmisi, canli_kayit_kokeni, canli_sema_denetimi) beklenen sonucu verdiğini sınar.
#
#   [DRILL_URL=postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres] bash scripts/canli-denetim-prova.sh
#   (git geçmişi tam olmalı: CI'da fetch-depth: 0; DRILL_URL verilirse 5. adım: KI-24 yolu, ana yerel yığına geçici veritabanı)
#
# 1  Boş canlı benzeri yığın (scripts/live-like-stack.sh, portlar 553xx, migration yok)
# 2  Demo kurulum dosyaları TARİHÎ hâlleriyle, SQL Editor gibi her biri tek işlemde:
#      01/02/03/04 @ f760625 (27.09) · 06 @ 62c0614, 86cd928, e1f64f4, d721428 (28.09; son hâli 20261001000001'de biter)
#    Önce her paketin migration bölümlerinin bugünkü migration dosyalarıyla birebir aynı olduğu denetlenir.
# 3  Beklenen: tespit 21 VAR / ilk eksik 20261002000001 / TAMAM · geçmiş İÇERİKSİZ=21, KAYITSIZ=10 (sahibin canlı CSV'si) ·
#    köken: demo işareti VAR, 21 kayıt statements NULL, kayıt grupları ŞEMA İLE AYNI İŞLEM (yeniden çalıştırılmış ilk 06 hariç:
#    BELİRSİZ), işaret V1 grubuyla aynı işlemde ·
#    şema denetimi: G TAMAM, P hepsi AYNI (başvuru: Supabase CLI ile kurulmuş yığın)
# 4  Negatif (geri alınan işlemlerde): RLS kapatma, kiracı tablosuna koşulsuz anon politika, fonksiyon gövdesi değişikliği,
#    sabitsiz SECURITY DEFINER, uygulamasız elle geçmiş kaydı → hepsi yakalanmalı
# 5  (DRILL_URL) yedek → scripts/restore-drill.sh: 9. adım denetimi geri yüklenen kopyada G TAMAM / P AYNI; RLS'i kapatılmış
#    kopyanın yedeği ŞEMA HATA (çıkış 3)
# =============================================================================
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
DB=postgresql://postgres:postgres@127.0.0.1:55322/postgres
OPS=supabase/ops
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fail() { echo "✗ $*" >&2; exit 1; }
ro() { PGOPTIONS='-c default_transaction_read_only=on' psql "$DB" -X -v ON_ERROR_STOP=1 -q -A -t -F'|' "$@"; }

BUNDLES=(f760625:01_v1_schema f760625:02_v2_enums f760625:03_v2_stage3 f760625:04_demo_seed
         62c0614:06_platform_updates 86cd928:06_platform_updates e1f64f4:06_platform_updates d721428:06_platform_updates)
echo "== 1/5 Tarihî demo paketleri ↔ bugünkü migration dosyaları"
for b in "${BUNDLES[@]}"; do
  git show "${b%%:*}:elvankent-gayrimenkul/supabase/demo/${b#*:}.sql" > "$T/$b.sql" || fail "git geçmişi eksik (${b%%:*}); fetch-depth: 0 gerekli"
done
node -e '
const fs = require("fs"); const [dir, ...names] = process.argv.slice(1);
const bar = "-- ---------------------------------------------------------------------------";
let n = 0;
for (const b of names) {
  const s = fs.readFileSync(`${dir}/${b}.sql`, "utf8");
  const re = new RegExp(`\\n${bar}\\n-- (\\d{14}_[a-z0-9_]+\\.sql)\\n${bar}\\n`, "g");
  for (const m of s.matchAll(re)) {
    const cur = fs.readFileSync(`supabase/migrations/${m[1]}`, "utf8").trimEnd();
    if (s.slice(m.index + m[0].length, m.index + m[0].length + cur.length + 1) !== cur + "\n") { console.error(`FARKLI: ${b} ${m[1]}`); process.exit(1); }
    n++;
  }
}
console.log(`   ${n} migration bölümü bugünkü dosyalarla birebir aynı`);
' "$T" "${BUNDLES[@]}"

echo "== 2/5 Boş yığın + demo paketleri (her biri tek işlem)"
echo 'select 1;' > "$T/bos.sql"
LIVE_LIKE_SEED="$T/bos.sql" bash scripts/live-like-stack.sh start 19000101000000 | sed 's/^/   /'
for b in "${BUNDLES[@]}"; do
  psql "$DB" -X -v ON_ERROR_STOP=1 -q -1 -f "$T/$b.sql" > "$T/$b.out" 2>&1 || { tail -5 "$T/$b.out" >&2; fail "$b uygulanamadı"; }
done
echo "   ${#BUNDLES[@]} paket uygulandı"

echo "== 3/5 Denetimler (salt okunur)"
ro -f "$OPS/canli_sema_tespiti.sql" > "$T/tespit"
[ "$(awk -F'|' '$1 <= 31 && $3 == "VAR"' "$T/tespit" | wc -l)" = 21 ] || fail "tespit: 21 VAR bekleniyordu"
grep -q '^102|İLK EKSİK migration|20261002000001_karay_platform.sql|' "$T/tespit" || fail "tespit: ilk eksik"
grep -q '^103|TUTARLILIK|TAMAM' "$T/tespit" || fail "tespit: tutarlılık"
echo "   tespit: 21 VAR, ilk eksik 20261002000001, TAMAM"
ro -f "$OPS/canli_migration_gecmisi.sql" > "$T/gecmis"
grep -q '^ÖZET|durumlar|İÇERİKSİZ=21, KAYITSIZ=10|' "$T/gecmis" || { grep ÖZET "$T/gecmis" >&2; fail "geçmiş: İÇERİKSİZ=21, KAYITSIZ=10 bekleniyordu"; }
echo "   geçmiş: İÇERİKSİZ=21, KAYITSIZ=10 (sahibin canlı çıktısıyla aynı)"
ro -f "$OPS/canli_kayit_kokeni.sql" > "$T/koken"
grep -q '^K1|.*|VAR · kurulum ' "$T/koken" || fail "köken: demo işareti"
[ "$(awk -F'|' '$1 == "K3" && $3 == "statements NULL"' "$T/koken" | wc -l)" = 21 ] || fail "köken: 21 NULL kayıt"
# 06'nın ilk sürümü (yalnız 20260929000001) sonraki 06 sürümleriyle yeniden oluşturulduğundan katalog satırı kalmaz: BELİRSİZ
[ "$(awk -F'|' '$1 == "K4" && $3 != "ŞEMA İLE AYNI İŞLEM" && $2 !~ /\(20260929000001 … 20260929000001\)/' "$T/koken" | wc -l)" = 0 ] \
  || { grep '^K4' "$T/koken" >&2; fail "köken: şemayla aynı işlemde olmayan grup"; }
grep -q '^K4|.*(20260929000001 … 20260929000001)|BELİRSİZ' "$T/koken" || fail "köken: yeniden çalıştırılan ilk 06 BELİRSİZ olmalı" 
grep -q '^K5|.*|kayıt grubu 20260922000001 … 20260922000004 ile AYNI işlem|' "$T/koken" || fail "köken: işaret V1 grubunda değil"
echo "   köken: işaret VAR, 21 kayıt NULL, $(grep -c '^K4' "$T/koken") kayıt grubu (biri BELİRSİZ: yeniden çalıştırılan ilk 06), işaret V1 grubunda"
ro -f "$OPS/canli_sema_denetimi.sql" > "$T/denetim"
grep -q '^ÖZET|G mutlak güvenlik kuralları|TAMAM' "$T/denetim" || fail "denetim: G"
[ "$(awk -F'|' '$1 ~ /^P / ' "$T/denetim" | wc -l)" = 0 ] || { awk -F'|' '$1 ~ /^P /' "$T/denetim" | head -20 >&2; fail "denetim: P'de AYNI olmayan nesne"; }
echo "   şema denetimi: G TAMAM, $(grep '^ÖZET|P beklenen' "$T/denetim" | cut -d'|' -f3) nesnenin hepsi AYNI"

echo "== 4/5 Negatif kontroller (geri alınan işlemlerde)"
neg() { # ad, sql, denetim dosyası, beklenen desen
  local out
  out=$(psql "$DB" -X -q -A -t -F'|' -c "begin;" -c "$2" -f "$OPS/$3" -c "rollback;" 2>&1) || true
  grep -Eq "$4" <<< "$out" || { echo "$out" | tail -5 >&2; fail "negatif: $1 yakalanmadı"; }
  echo "   ✓ $1"
}
neg 'RLS kapalı kiracı tablosu' 'alter table public.leads disable row level security;' canli_sema_denetimi.sql '^G1\|leads\|HATA'
neg 'kiracı tablosuna koşulsuz anon politika' 'create policy x_open on public.properties for select to anon using (true);' canli_sema_denetimi.sql '^G2\|properties\.x_open\|HATA'
neg 'fonksiyon gövdesi değişti' "create or replace function public.session_aal() returns text language sql stable as \$\$ select 'aal2' \$\$;" canli_sema_denetimi.sql '^P fonksiyon\|session_aal\(\)\|FARKLI'
neg 'sabitsiz SECURITY DEFINER' 'create function public.x_definer() returns int language sql security definer as $$ select 1 $$;' canli_sema_denetimi.sql '^G3\|x_definer\(\)\|HATA'
neg 'anon yetkisi genişledi' 'grant insert on public.audit_logs to anon;' canli_sema_denetimi.sql '^P tablo-yetki\|audit_logs\|FARKLI'
neg 'uygulamasız elle geçmiş kaydı' "insert into supabase_migrations.schema_migrations (version, name) values ('20261002000001', 'karay_platform');" canli_kayit_kokeni.sql '^K4\|.*20261002000001.*\|BELİRSİZ'

if [ -n "${DRILL_URL:-}" ]; then
  echo "== 5/5 KI-24 yolu: bu veritabanının yedeği → yerel geçici veritabanı → restore-drill 9. adım (denetim)"
  SUPABASE_DB_URL="$DB" OUT_DIR="$T/y1" STAMP=denetim-1 bash scripts/backup-db.sh > "$T/y1.log" 2>&1 || { tail -5 "$T/y1.log" >&2; fail "yedek alınamadı"; }
  code=0; ADMIN_DB_URL="$DRILL_URL" DRILL_RESULT="$T/y1.res" bash scripts/restore-drill.sh "$T/y1" denetim-1 > "$T/y1.drill" 2>&1 || code=$?
  for want in BUTUNLUK=TAMAM SEMA=BILGI DENETIM_G=TAMAM DENETIM_P=AYNI; do
    grep -qx "$want" "$T/y1.res" || { tail -15 "$T/y1.drill" >&2; fail "geri yüklenen kopyada $want yok (çıkış $code)"; }
  done
  [ "$code" = 0 ] || fail "restore-drill çıkışı $code"
  echo "   ✓ geri yüklenen kopya: BÜTÜNLÜK TAMAM, ŞEMA BİLGİ, denetim G TAMAM, P hepsi AYNI"
  psql "$DB" -X -q -v ON_ERROR_STOP=1 -c 'alter table public.leads disable row level security'
  SUPABASE_DB_URL="$DB" OUT_DIR="$T/y2" STAMP=denetim-2 bash scripts/backup-db.sh > "$T/y2.log" 2>&1 || fail "yedek 2 alınamadı"
  code=0; ADMIN_DB_URL="$DRILL_URL" DRILL_RESULT="$T/y2.res" bash scripts/restore-drill.sh "$T/y2" denetim-2 > "$T/y2.drill" 2>&1 || code=$?
  { [ "$code" = 3 ] && grep -qx SEMA=HATA "$T/y2.res"; } || { tail -15 "$T/y2.drill" >&2; fail "RLS kapalı yedek ŞEMA HATA (çıkış 3) vermeli; çıkış $code"; }
  echo "   ✓ RLS'i kapalı tablo içeren yedek: ŞEMA HATA, çıkış 3 (gizlenmedi)"
fi
bash scripts/live-like-stack.sh stop > /dev/null
echo "✓ Canlı denetim provası tamam"
