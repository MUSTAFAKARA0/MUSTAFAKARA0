import { defineConfig, devices } from '@playwright/test';

/**
 * Uçtan uca testler. Çalışan bir uygulamaya (varsayılan http://localhost:3000)
 * ve Supabase'e karşı çalışır. Ayrıntılar: TESLIM_RAPORU.md > Testler
 */
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
    { name: 'desktop', use: { ...devices['Desktop Chrome'], userAgent, launchOptions: { executablePath } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], userAgent: `${devices['Pixel 7'].userAgent} E2E`, launchOptions: { executablePath } },
      testMatch: /visitor\.spec\.ts|responsive\.spec\.ts/,
    },
  ],
});
