import { defineConfig, devices } from '@playwright/test';

/**
 * Uçtan uca testler. Çalışan bir uygulamaya (varsayılan http://localhost:3000)
 * ve Supabase'e karşı çalışır. Ayrıntılar: TESLIM_RAPORU.md > Testler
 */
// Yerel .env.local varsa yüklenir (izolasyon testi service_role ile geçici kiracı oluşturur)
try {
  process.loadEnvFile('.env.local');
} catch {
  // dosya yoksa ortam değişkenleri dışarıdan verilmiştir
}
// CI'da (GitHub Actions, CI=true) yalnızca işin kendi geçici yerel Supabase'i kullanılır: testler service_role
// ile kiracı ve kullanıcı oluşturup siler; production veya paylaşılan bir projeye yönelirse hiç başlamaz
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (process.env.CI && supabaseUrl && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(supabaseUrl)) {
  throw new Error("CI: NEXT_PUBLIC_SUPABASE_URL yerel değil; E2E CI'da yalnızca geçici yerel Supabase ile çalışır");
}

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
// Headless tarayıcı kullanıcı ajanı istatistikte "bot" sayılmasın diye normal Chrome UA kullanılır
const userAgent =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 E2E';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    userAgent,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], userAgent, launchOptions: { executablePath } }, testIgnore: /acceptance\.spec\.ts/ },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], userAgent: `${devices['Pixel 7'].userAgent} E2E`, launchOptions: { executablePath } },
      testMatch: /visitor\.spec\.ts|responsive\.spec\.ts|acceptance\.spec\.ts/,
    },
    {
      // iPhone ekran ölçüsü ve dokunmatik davranışı (Chromium ile; gerçek Safari değildir)
      name: 'iphone',
      use: { ...devices['iPhone 13'], browserName: 'chromium', userAgent: `${devices['iPhone 13'].userAgent} E2E`, launchOptions: { executablePath } },
      testMatch: /acceptance\.spec\.ts/,
    },
  ],
});
