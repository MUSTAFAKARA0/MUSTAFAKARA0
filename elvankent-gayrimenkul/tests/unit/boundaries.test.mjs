/**
 * Mimari katman sınırları (eslint.config.mjs) gerçekten uygulanıyor mu?
 * Sanal dosya yollarıyla ESLint çalıştırılır; diske dosya yazılmaz.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('../../', import.meta.url).pathname });

async function violations(filePath, source) {
  const [result] = await eslint.lintText(`${source}\nexport const x = 1;\n`, { filePath });
  return result.messages.filter((m) => m.ruleId === 'no-restricted-imports' || m.ruleId === 'no-restricted-syntax').map((m) => m.ruleId);
}

const CASES = [
  // [açıklama, dosya, içe aktarım, yasak mı]
  ['site-engine → ofis paneli', 'src/components/layout/__x.tsx', "import { A } from '@/components/admin/admin-shell';", true],
  ['site-engine → KARAY konsolu', 'src/app/t/[tenant]/__x.tsx', "import { A } from '@/components/platform/karay-forms';", true],
  ['site-engine → KARAY sayfası', 'src/components/property/__x.tsx', "import { A } from '@/modules/karay/profile';", true],
  ['site-engine → KARAY işlemi', 'src/components/forms/__x.tsx', "import { A } from '@/app/actions/site-builder';", true],
  ['ofis paneli → KARAY konsolu', 'src/components/admin/__x.tsx', "import { A } from '@/components/platform/platform-nav';", true],
  ['ofis paneli → KARAY işlemi', 'src/app/admin/(panel)/__x.tsx', "import { A } from '@/app/actions/platform';", true],
  ['KARAY konsolu → ofis paneli', 'src/app/platform/(konsol)/__x.tsx', "import { A } from '@/components/admin/admin-shell';", true],
  ['KARAY konsolu → ofis işlemi', 'src/components/platform/__x.tsx', "import { A } from '@/app/actions/admin-settings';", true],
  ['KARAY sayfası → ofis paneli', 'src/components/karay/__x.tsx', "import { A } from '@/components/admin/ui';", true],
  ['KARAY sayfası → KARAY konsolu', 'src/app/karay/__x.tsx', "import { A } from '@/components/platform/site/site-actions';", true],
  ['alt katman (site-config) → site bileşeni', 'src/site-config/__x.ts', "import { A } from '@/components/layout/site-header';", true],
  ['alt katman (modules) → arama bileşeni', 'src/modules/properties/__x.ts', "import { A } from '@/components/search/hero-search';", true],
  ['alt katman (ui) → ofis paneli', 'src/components/panel/__x.tsx', "import { A } from '@/components/admin/admin-shell';", true],
  ['theme-engine → site-config', 'src/theme-engine/__x.ts', "import { A } from '@/site-config/schema';", true],
  ['theme-engine → site bileşeni', 'src/theme-engine/preview/__x.tsx', "import { A } from '@/components/layout/site-header';", true],
  ['theme-engine → ofis paneli', 'src/theme-engine/__x.ts', "import { A } from '@/components/admin/ui';", true],
  ['core → site-config', 'src/platform/tenant/__x.ts', "import { A } from '@/site-config/load';", true],
  ['core → theme-engine', 'src/lib/__x.ts', "import { A } from '@/theme-engine';", true],
  ['ortak arayüz → site-config', 'src/components/panel/__x.tsx', "import { A } from '@/site-config/schema';", true],
  ['site-config → KARAY konsolu (site oluşturucu)', 'src/site-config/__x.ts', "import { A } from '@/app/actions/site-builder';", true],
  ['ofis paneli → kiracı sitesi bileşeni', 'src/components/admin/__x.tsx', "import { A } from '@/components/property/property-card';", true],
  ['site oluşturucu → kiracı sitesi bileşeni', 'src/components/platform/site/__x.tsx', "import { A } from '@/components/layout/site-header';", true],
  ['KARAY sayfası → kiracı sitesi bileşeni', 'src/components/karay/__x.tsx', "import { A } from '@/components/home/hero';", true],
  ['göreli üst klasör yolu', 'src/components/layout/__x.tsx', "import { A } from '../admin/admin-shell';", true],
  // İzin verilenler
  ['site-engine → ui / modules / theme-engine', 'src/components/layout/__x.tsx', "import { A } from '@/components/ui/button';\nimport { B } from '@/modules/properties/queries';\nimport { C } from '@/theme-engine/themes';", false],
  ['ofis paneli → ortak bileşenler (görsel, harita, sayı girişi)', 'src/components/admin/__x.tsx', "import { A } from '@/components/common/media-image';\nimport { B } from '@/components/common/maps/lazy-map';\nimport { C } from '@/components/ui/number-input';", false],
  ['ofis paneli → ortak panel arayüzü', 'src/app/admin/(panel)/__x.tsx', "import { A } from '@/components/panel/ui';", false],
  ['KARAY konsolu → ortak panel arayüzü ve marka', 'src/app/platform/(konsol)/__x.tsx', "import { A } from '@/components/panel/audit-list';\nimport { B } from '@/components/brand/platform-wordmark';", false],
  ['KARAY sayfası → tema önizlemesi', 'src/components/karay/__x.tsx', "import { A } from '@/theme-engine/preview/live-preview';", false],
  ['site-engine → theme-engine', 'src/app/t/[tenant]/__x.tsx', "import { applyTheme } from '@/theme-engine';", false],
  ['site-engine → site-config', 'src/app/t/[tenant]/__x.tsx', "import { A } from '@/site-config/load';", false],
  ['KARAY konsolu (site oluşturucu) → site-config', 'src/components/platform/site/__x.tsx', "import { A } from '@/site-config/schema';", false],
  ['site-config → core', 'src/site-config/__x.ts', "import { A } from '@/platform/tenant/tenant';", false],
  ['site-config → theme-engine', 'src/site-config/__x.ts', "import { A } from '@/theme-engine/settings';", false],
  ['theme-engine → core / ui', 'src/theme-engine/__x.ts', "import { A } from '@/platform/branding/theme';\nimport { B } from '@/components/ui/button';", false],
];

describe('Katman sınırları', () => {
  for (const [name, file, source, forbidden] of CASES) {
    test(`${forbidden ? 'yasak' : 'izinli'}: ${name}`, async () => {
      const found = await violations(file, source);
      if (forbidden) assert.ok(found.length > 0, `${file} içinde "${source}" yakalanmadı`);
      else assert.deepEqual(found, [], `${file} içinde izinli içe aktarım engellendi`);
    });
  }
});
