import { defineConfig, devices } from "@playwright/test";

// E2E-tests draaien tegen een productiebuild met de meegeleverde snapshot (VRIJSTAAN_OFFLINE=1), zodat ze
// zonder netwerk en zonder Supabase reproduceerbaar zijn. Eerst bouwen: `npm run build:offline`.
const PORT = Number(process.env.PORT ?? 3100);
const chromiumPath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : undefined,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/places`,
    env: { VRIJSTAAN_OFFLINE: "1" },
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
