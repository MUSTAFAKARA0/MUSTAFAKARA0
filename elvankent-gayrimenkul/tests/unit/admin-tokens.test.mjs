/**
 * Faz 3 (panel tasarım sistemi): panel bileşenlerinde ham hex renk yok (tokenlar kullanılır; karanlık tema hazırlığı),
 * tablo/boş durum/grafik/form erişilebilirlik sözleşmeleri, sürekli hareketin yalnızca no-preference içinde olması
 * ve server action dışa aktarımlarının değişmemesi (yalnızca görsel faz).
 * Çalıştırma: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

// Veri olarak gereken hex'ler (renk girdisi varsayılanı, kontrast hesabı): ham renk stili değildir
const ALLOW = new Set(['src/components/admin/settings/company-form.tsx']);

test('AT-01 panel bileşenlerinde ham hex renk yok (allowlist dışı)', () => {
  const offenders = [];
  for (const dir of ['src/components/admin', 'src/components/panel', 'src/components/platform', 'src/components/ui']) {
    for (const f of walk(dir).filter((x) => /\.tsx?$/.test(x) && !ALLOW.has(x))) {
      if (/#[0-9a-fA-F]{6}(?![0-9a-fA-F])|#[0-9a-fA-F]{3}(?![0-9a-zA-Z-])/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''))) offenders.push(f);
    }
  }
  assert.deepEqual(offenders, []);
});

test('AT-02 panel tokenları tanımlı ve admin kökü tokenla boyanır', () => {
  const css = read('src/app/globals.css');
  for (const t of ['--sidebar-bg', '--topbar-bg', '--row-h-compact', '--row-h-comfortable', '--shadow-1', '--shadow-2', '--shadow-3']) assert.ok(css.includes(`${t}:`), t);
  assert.doesNotMatch(read('src/app/admin/layout.tsx'), /bg-\[#/);
});

test('AT-03 skeleton hareketi yalnızca prefers-reduced-motion: no-preference içinde', () => {
  const css = read('src/app/globals.css');
  const m = css.match(/\.skeleton \{[^}]*\}/);
  assert.ok(m && !/animation/.test(m[0]), 'temel .skeleton animasyon içermez');
  assert.match(css, /@media \(prefers-reduced-motion: no-preference\) \{\s*\.skeleton \{\s*animation/);
});

test('AT-04 TableWrap: caption (sr-only), sticky/yoğunluk/kart öznitelikleri; Th scope=col + aria-sort', () => {
  const ui = read('src/components/panel/ui.tsx');
  assert.match(ui, /<caption className="sr-only">/);
  for (const a of ['data-sticky', 'data-density', 'data-cards', 'data-zebra']) assert.ok(ui.includes(a), a);
  assert.match(ui, /scope="col"/);
  assert.match(ui, /aria-sort=\{sort\}/);
  assert.match(ui, /role="columnheader"/);
  // Kart kipi tablo anlamını korur: Tr/Td açık row/cell rolleri taşır
  assert.match(ui, /<tr role="row"/);
  assert.match(ui, /<td role="cell"/);
});

test('AT-05 boş durum: EmptyFiltered "Filtreleri temizle" bağlantısı sunar', () => {
  assert.match(read('src/components/panel/empty-filtered.tsx'), /Filtreleri temizle/);
});

test('AT-06 grafik: veri yetersizse dürüst boş durum, SVG title/desc ve tablo yedeği', () => {
  const c = read('src/components/admin/charts.tsx');
  assert.match(c, /Henüz yeterli veri yok/);
  assert.match(c, /<title>\{caption\}<\/title>/);
  assert.match(c, /<div className="sr-only">\s*<table>/);
  const s = read('src/components/panel/sparkline.tsx');
  assert.match(s, /clean\.length < 2/);
  assert.match(s, /<title id=/);
});

test('AT-07 AdminPageHeader: breadcrumbs ve status eklendi, mevcut back/actions korunur', () => {
  const ui = read('src/components/panel/ui.tsx');
  assert.match(ui, /breadcrumbs\?: Crumb\[\]/);
  assert.match(ui, /status\?: React\.ReactNode/);
  assert.match(ui, /back\?: \{ href: string; label: string \}/);
  assert.match(read('src/components/panel/breadcrumbs.tsx'), /aria-label="Sayfa yolu"/);
});

test('AT-08 her loading.tsx için kardeş page.tsx yönlendirme/notFound/izin çağrısı içermez (akış 200 ile başlar, 404/307 kaybolur)', () => {
  const FORBIDDEN = /notFound\(|redirect\(|requirePagePermission\(|requireSuperAdminPage\(|requirePageContext\(/;
  // Faz 3 yüzeyleri (admin + platform): hiçbir loading.tsx olamaz çünkü sayfaların tümü izin/yönlendirme yapar; yine de kural genel
  const loadings = walk('src/app/admin').concat(walk('src/app/platform')).filter((f) => f.endsWith('/loading.tsx'));
  for (const f of loadings) {
    const page = read(f.replace(/loading\.tsx$/, 'page.tsx'));
    assert.doesNotMatch(page, FORBIDDEN, `${f}: sibling page yönlendirme/notFound içeriyor`);
  }
  // Panel kökü ve [id] içeren bölümlerde hiç loading.tsx yok
  for (const p of ['src/app/admin/(panel)/loading.tsx', 'src/app/platform/(konsol)/loading.tsx']) assert.throws(() => read(p), /ENOENT/);
});

test('AT-09 AppToaster yalnızca panel kök layout larında; diğer yüzeyler eski Toaster ı korur; hata toast ı uzun kalır', () => {
  const t = read('src/components/ui/toaster.tsx');
  assert.match(t, /visibleToasts=\{3\}/);
  const root = read('src/components/common/root-document.tsx');
  assert.match(root, /appToaster \? <AppToaster \/> : <Toaster position="top-center" richColors closeButton/);
  assert.match(root, /appToaster = false/);
  assert.match(read('src/app/admin/layout.tsx'), /<RootDocument [^>]*appToaster/);
  assert.match(read('src/app/platform/layout.tsx'), /<RootDocument appToaster>/);
  for (const p of ['src/app/t/layout.tsx', 'src/app/karay/layout.tsx', 'src/app/site-onizleme/layout.tsx']) assert.doesNotMatch(read(p), /appToaster/);
  assert.match(read('src/components/ui/toast.ts'), /ERROR_TOAST_MS = 8000/);
  assert.match(read('src/app/globals.css'), /\.app-toast\[data-rich-colors='true'\]\[data-type='error'\]/);
});

test('AT-11 Th (scope+aria-sort) panel tablolarında kullanılır; çıplak <th> yalnız kart kipi dışı onay kutusu sütunlarında', () => {
  for (const f of [
    'src/components/platform/org-table.tsx',
    'src/app/admin/(panel)/kullanicilar/page.tsx',
    'src/app/admin/(panel)/analitik/page.tsx',
    'src/app/admin/(panel)/seo/page.tsx',
    'src/app/platform/(konsol)/siteler/page.tsx',
    'src/app/platform/(konsol)/kullanicilar/page.tsx',
    'src/app/admin/(panel)/talepler/page.tsx',
  ]) {
    const src = read(f);
    assert.match(src, /<Th[ >]/, `${f}: Th kullanılmalı`);
    assert.doesNotMatch(src, /<th className=\{/, `${f}: th sabiti yerine Th`);
  }
  const lt = read('src/components/admin/listings/listings-table.tsx');
  assert.match(lt, /<Th /);
  assert.doesNotMatch(lt, /<th className="[^"]*uppercase/);
});

test('AT-12 Sparkline kimlikleri useId ile üretilir (sabit id yok)', () => {
  const s = read('src/components/panel/sparkline.tsx');
  assert.match(s, /useId\(\)/);
  assert.doesNotMatch(s, /id="spark-/);
});

function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('AT-13 panel token çiftleri WCAG AA (metin >= 4.5:1)', () => {
  const css = read('src/app/globals.css');
  const root = css.slice(css.indexOf(':root'), css.indexOf('@theme'));
  const tok = (name) => {
    const m = root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `--${name} bulunamadı`);
    return m[1];
  };
  const pairs = [
    ['foreground', 'background'],
    ['foreground', 'surface'],
    ['foreground', 'sidebar-bg'],
    ['foreground', 'topbar-bg'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'surface'],
    ['muted-foreground', 'surface-muted'],
    ['muted-foreground', 'sidebar-bg'],
    ['muted-foreground', 'topbar-bg'],
    ['success', 'success-soft'],
    ['warning', 'warning-soft'],
    ['danger', 'danger-soft'],
    ['info', 'info-soft'],
    ['success', 'surface'],
    ['danger', 'surface'],
    ['serp-title', 'surface'],
    ['serp-muted', 'surface'],
    ['inverse-foreground', 'surface-inverse'],
  ];
  const failing = pairs.map(([fg, bg]) => [fg, bg, ratio(tok(fg), tok(bg))]).filter(([, , r]) => r < 4.5);
  assert.deepEqual(failing, []);
});

// AT-10: korunan dizinler (iş mantığı / yetki / auth) görsel fazda değişmez
const PROTECTED_DIRS = ['src/app/actions', 'src/modules', 'src/platform/auth'];

test('AT-10a dışa aktarım yüzeyi (export function/const/class/{}/*/default, özyinelemeli) manifestteki ile aynı kalır', () => {
  const surface = {};
  for (const d of PROTECTED_DIRS) {
    for (const f of walk(d).filter((x) => /\.(ts|tsx|mjs)$/.test(x))) {
      const src = read(f);
      const names = new Set();
      for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class|enum|interface|type)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
      for (const m of src.matchAll(/^export\s*(?:type\s*)?\{([^}]*)\}/gm)) for (const part of m[1].split(',')) if (part.trim()) names.add(part.trim().split(/\s+as\s+/).pop());
      for (const m of src.matchAll(/^export\s*\*\s*(?:as\s+([A-Za-z0-9_$]+)\s+)?from\s+['"]([^'"]+)['"]/gm)) names.add(`*${m[1] ?? ''}:${m[2]}`);
      if (/^export\s+default\b/m.test(src)) names.add('default');
      if (names.size) surface[f] = [...names].sort();
    }
  }
  const manifest = JSON.parse(read('tests/unit/protected-surface.json'));
  assert.deepEqual(surface, manifest, 'dışa aktarım yüzeyi değişti; bilinçliyse: node scripts/gen-protected-manifest.mjs');
});

test('AT-10c manifest betiği CI içinde çalışmayı reddeder', () => {
  assert.match(read('scripts/gen-protected-manifest.mjs'), /if \(process\.env\.CI\) \{[\s\S]*process\.exit\(1\)/);
});
