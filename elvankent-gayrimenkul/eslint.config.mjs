import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/*
 * Mimari katman sınırları (docs/MIMARI_KATMANLAR.md).
 *
 *   app
 *    ↓
 *   site-preview                                 (KARAY önizlemesi: site-engine + site-factory; kimse içe aktarmaz)
 *    ↓
 *   tenant-panel · karay-platform · site-engine · karay-public
 *    ↓
 *   site-editor                                  (ortak site düzenleyici: taslak/yayın servisi + formlar;
 *    ↓                                            KARAY konsolu VE ofis paneli kullanır, kiracı sitesi bilmez)
 *   site-factory                                 (yalnızca KARAY konsolu; site çalışma zamanına girmez)
 *    ↓
 *   site-config · theme-engine · modules        (site-config → theme-engine; tersi yasak)
 *    ↓
 *   ui · core                                    (site-config / theme-engine bilinmez)
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
    files: ["src/app/platform/**", "src/components/platform/**", "src/app/api/platform/**", "src/app/actions/{platform,site-builder,karay-admin,site-create}.ts"],
    regex: "^@/(components/platform|app/platform|app/api/platform)(/|$)|^@/app/actions/(platform|site-builder|karay-admin|site-create)$",
    label: "KARAY platform konsolu (karay-platform)",
  },
  // KARAY'ın herkese açık şirket sayfası
  karayPublic: {
    files: ["src/app/karay/**", "src/components/karay/**", "src/modules/karay/**", "src/app/actions/karay.ts"],
    regex: "^@/(components/karay|app/karay|modules/karay)(/|$)|^@/app/actions/karay$",
    label: "KARAY tanıtım sayfası (karay-public)",
  },
  // Ortak site düzenleyici (P0.1): taslak → önizleme → yayın → geri alma servisi ve formlar. KARAY
  // Site Builder ile ofis /admin/site AYNI kodu kullanır; yetki ve organizasyon kaynağı çağıran
  // işlemdedir. Panel kodunu ve kiracı sitesini bilmez; kiracı sitesine girmez.
  siteEditor: {
    files: ["src/site-editor/**", "src/components/site-editor/**"],
    regex: "^@/(site-editor|components/site-editor)(/|$)",
    label: "ortak site düzenleyici (site-editor)",
  },
  // Site yapılandırması: site oluşturucunun ürettiği, Site Engine'in okuduğu veri
  // (şema, varsayılanlar, yayın/önizleme yükleme, menü/sayfa çözümleme)
  siteConfig: {
    files: ["src/site-config/**"],
    regex: "^@/site-config(/|$)",
    label: "site yapılandırması (site-config)",
  },
  // Site Factory: KARAY'ın iç tasarım kataloğu ve derleyicisi (yalnızca KARAY konsolu kullanır;
  // müşteri sitesinin çalışma zamanına girmez)
  siteFactory: {
    files: ["src/site-factory/**"],
    regex: "^@/site-factory(/|$)",
    label: "Site Factory (tasarım kataloğu)",
  },
  // KARAY gerçek önizlemesi (Yeni Site Oluştur): manifesti Site Engine'in GERÇEK bileşenleriyle
  // örnek veriyle çizer. Ayrı giriş noktasıdır: hiçbir bölge bunu içe aktaramaz (kiracı sitesi ve
  // sihirbaz paketine önizleme kodu girmez; sihirbaz önizlemeyi yalnızca adresiyle, çerçevede açar)
  sitePreview: {
    files: ["src/app/site-onizleme/**", "src/site-preview/**"],
    regex: "^@/(site-preview|app/site-onizleme)(/|$)",
    label: "KARAY site önizlemesi (site-preview)",
  },
  // Görsel sistem (temalar, belirteçler, paletler, yazı tipleri, tema CSS'i, önizleme)
  themeEngine: {
    files: ["src/theme-engine/**"],
    regex: "^@/theme-engine(/|$)",
    label: "Theme Engine",
  },
  // Kiracıların herkese açık siteleri
  siteEngine: {
    files: ["src/app/t/**", "src/components/{layout,home,property,search,content,gallery,forms,site,patterns}/**"],
    regex: "^@/(components/(layout|home|property|search|content|gallery|forms|site|patterns)|app/t)(/|$)",
    label: "kiracı sitesi (site-engine)",
  },
};

const forbidWith = (paths, ...zones) => ({
  "no-restricted-imports": [
    "error",
    {
      paths,
      patterns: zones.map((z) => ({
        regex: z.regex,
        message: `Katman sınırı: bu bölge ${z.label} kodunu içe aktaramaz. Ortak kodu alt katmana (ui, core, modules, site-config) taşıyın.`,
      })),
    },
  ],
});
const forbid = (...zones) => forbidWith([], ...zones);

const CORE_UI = ["src/lib/**", "src/hooks/**", "src/types/**", "src/platform/**", "src/components/{ui,panel,brand,common}/**"];
const LOWER_LAYERS = [...CORE_UI, "src/site-config/**", "src/modules/**"];

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
    rules: forbid(ZONES.tenantPanel, ZONES.karayPlatform, ZONES.karayPublic, ZONES.siteEngine, ZONES.siteFactory, ZONES.sitePreview, ZONES.siteEditor),
  },
  // Çekirdek ve ortak arayüz: site yapılandırmasını ve Theme Engine'i de bilmez
  {
    files: CORE_UI,
    rules: forbid(ZONES.tenantPanel, ZONES.karayPlatform, ZONES.karayPublic, ZONES.siteEngine, ZONES.siteConfig, ZONES.themeEngine, ZONES.siteFactory, ZONES.sitePreview, ZONES.siteEditor),
  },
  // Theme Engine: görsel sistem; site yapılandırmasının geri kalanını, site motorunu,
  // panelleri ve KARAY kodunu bilmez (girdisi yalnızca ThemeInput verisidir)
  {
    files: ["src/theme-engine/**"],
    rules: forbid(ZONES.siteConfig, ZONES.siteEngine, ZONES.tenantPanel, ZONES.karayPlatform, ZONES.karayPublic, ZONES.siteFactory, ZONES.sitePreview, ZONES.siteEditor),
  },
  // Site Factory: katalog + derleyici. Theme Engine ve site-config'i kullanır; siteleri çizen
  // Site Engine'i, panelleri ve KARAY arayüzünü bilmez
  {
    files: ZONES.siteFactory.files,
    rules: forbid(ZONES.siteEngine, ZONES.tenantPanel, ZONES.karayPlatform, ZONES.karayPublic, ZONES.sitePreview, ZONES.siteEditor),
  },
  // Ortak site düzenleyici: Site Factory, site-config, Theme Engine ve alt katmanları kullanır;
  // panelleri (ofis/KARAY), KARAY sayfasını, kiracı sitesi bileşenlerini ve önizleme kodunu bilmez
  {
    files: ZONES.siteEditor.files,
    rules: forbid(ZONES.tenantPanel, ZONES.karayPlatform, ZONES.karayPublic, ZONES.siteEngine, ZONES.sitePreview),
  },
  // Kiracı sitesi: ofis paneli, KARAY konsolu ve KARAY sayfası kodu YOK
  // Kiracı sitesi sayfaları kiracıyı site-config üzerinden yükler (KARAY önizlemesinde taslak marka uygulanır)
  {
    files: ZONES.siteEngine.files,
    rules: forbidWith(
      [{ name: "@/platform/tenant/tenant", importNames: ["requireTenant"], message: "Kiracı sitesinde requireSiteTenant (@/site-config/load) kullanın: önizlemede taslak marka uygulanır." }],
      ZONES.tenantPanel,
      ZONES.karayPlatform,
      ZONES.karayPublic,
      ZONES.siteFactory,
      ZONES.sitePreview,
      ZONES.siteEditor,
    ),
  },
  // Ofis paneli ↛ KARAY konsolu / KARAY sayfası / kiracı sitesi bileşenleri. Site Factory'yi YALNIZCA
  // sunucuda kullanır (Tasarım sayfası: izinli ailelerin görünen bilgileri + derleyici); istemciye
  // yalnızca izinli ailelerin verisi gider (PERMISSION testi). Kiracı SİTESİ katalogu hiç içe aktaramaz.
  { files: ZONES.tenantPanel.files, rules: forbid(ZONES.karayPlatform, ZONES.karayPublic, ZONES.siteEngine, ZONES.sitePreview) },
  // KARAY konsolu ↛ ofis paneli / kiracı sitesi bileşenleri (site oluşturucu yapılandırma üretir,
  // siteyi Site Engine çizer; önizleme Theme Engine'in önizlemesiyle yapılır)
  { files: ZONES.karayPlatform.files, rules: forbid(ZONES.tenantPanel, ZONES.siteEngine, ZONES.sitePreview) },
  // Önizleme: Site Engine bileşenleri + Site Factory derleyicisi; panel/KARAY arayüzü yok
  { files: ZONES.sitePreview.files, rules: forbid(ZONES.tenantPanel, ZONES.karayPlatform, ZONES.karayPublic, ZONES.siteEditor) },
  // KARAY sayfası ↛ ofis paneli / KARAY konsolu / kiracı sitesi bileşenleri
  { files: ZONES.karayPublic.files, rules: forbid(ZONES.tenantPanel, ZONES.karayPlatform, ZONES.siteEngine, ZONES.siteFactory, ZONES.sitePreview, ZONES.siteEditor) },
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
