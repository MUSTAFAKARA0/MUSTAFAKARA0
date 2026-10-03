import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Mimari katman sınırları (docs/MIMARI_KATMANLAR.md).
 *
 *   app
 *    ↓
 *   tenant-panel · karay-platform · site-engine · karay-public
 *    ↓
 *   site-config · theme-engine · modules
 *    ↓
 *   ui · core
 *
 * Bir bölgedeki dosya yalnızca kendi bölgesini ve ALT katmanları içe aktarabilir.
 * Kural ihlali CI'da hata verir; istisna eklemek yerine kodu doğru katmana taşıyın.
 */
const ZONES = {
  // Ofis (emlakçı) paneli
  tenantPanel: {
    files: ["src/app/admin/**", "src/components/admin/**", "src/app/api/admin/**", "src/app/actions/admin-*.ts"],
    regex: "^@/(components/admin|app/admin|app/api/admin)(/|$)|^@/app/actions/admin-",
    label: "ofis paneli (tenant-panel)",
  },
  // KARAY platform konsolu (süper admin, site oluşturucu)
  karayPlatform: {
    files: ["src/app/platform/**", "src/components/platform/**", "src/app/api/platform/**", "src/app/actions/{platform,site-builder,karay-admin}.ts"],
    regex: "^@/(components/platform|app/platform|app/api/platform)(/|$)|^@/app/actions/(platform|site-builder|karay-admin)$",
    label: "KARAY platform konsolu (karay-platform)",
  },
  // KARAY'ın herkese açık şirket sayfası
  karayPublic: {
    files: ["src/app/karay/**", "src/components/karay/**", "src/modules/karay/**", "src/app/actions/karay.ts"],
    regex: "^@/(components/karay|app/karay|modules/karay)(/|$)|^@/app/actions/karay$",
    label: "KARAY tanıtım sayfası (karay-public)",
  },
  // Kiracıların herkese açık siteleri
  siteEngine: {
    files: ["src/app/t/**", "src/components/{layout,home,property,search,content,gallery,maps,forms}/**"],
    regex: "^@/(components/(layout|home|property|search|content|gallery|maps|forms)|app/t)(/|$)",
    label: "kiracı sitesi (site-engine)",
  },
};

const forbid = (...zones) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: zones.map((z) => ({
        regex: z.regex,
        message: `Katman sınırı: bu bölge ${z.label} kodunu içe aktaramaz. Ortak kodu alt katmana (ui, core, modules, platform/site) taşıyın.`,
      })),
    },
  ],
});

const LOWER_LAYERS = [
  "src/lib/**",
  "src/hooks/**",
  "src/types/**",
  "src/platform/**",
  "src/modules/**",
  "src/components/{ui,panel,brand,common,site-preview}/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Alt katmanlar (core, ui, site-config, theme-engine, modules) üst katmanları bilmez
  {
    files: LOWER_LAYERS,
    ignores: ZONES.karayPublic.files,
    rules: forbid(ZONES.tenantPanel, ZONES.karayPlatform, ZONES.karayPublic, ZONES.siteEngine),
  },
  // Kiracı sitesi: ofis paneli, KARAY konsolu ve KARAY sayfası kodu YOK
  { files: ZONES.siteEngine.files, rules: forbid(ZONES.tenantPanel, ZONES.karayPlatform, ZONES.karayPublic) },
  // Ofis paneli ↛ KARAY konsolu / KARAY sayfası
  { files: ZONES.tenantPanel.files, rules: forbid(ZONES.karayPlatform, ZONES.karayPublic) },
  // KARAY konsolu ↛ ofis paneli
  { files: ZONES.karayPlatform.files, rules: forbid(ZONES.tenantPanel) },
  // KARAY sayfası ↛ ofis paneli / KARAY konsolu
  { files: ZONES.karayPublic.files, rules: forbid(ZONES.tenantPanel, ZONES.karayPlatform) },
  // Sınırların göreli yollarla (../) aşılmaması için üst klasöre göreli içe aktarım kapalı
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportDeclaration[source.value=/^\\.\\.\\//]",
          message: "Üst klasöre göreli içe aktarım yerine @/ yolunu kullanın (katman sınırları @/ yollarıyla denetlenir).",
        },
      ],
    },
  },
]);

export default eslintConfig;
