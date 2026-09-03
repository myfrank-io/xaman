import { defineConfig, devices } from "@playwright/test";

// E2E (E9-3): runs against the dev server (the /dev/ui mock pages exist only outside
// production) or against E2E_BASE_URL when set. Three viewports of the product: iPad
// landscape, iPad portrait, iPhone.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    locale: "fr-FR",
    trace: "retain-on-failure",
    // Sandboxes with a pre-installed Chromium (no `playwright install`) point here.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    {
      name: "ipad-landscape",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 }, hasTouch: true },
    },
    {
      name: "ipad-portrait",
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: "iphone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      // The floor the app is held to, mobile-first: a small Android in portrait. Everything
      // that survives 360 px survives every phone anyone brings aboard.
      name: "android-small",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 640 }, hasTouch: true },
    },
    {
      // The hard floor: an iPhone SE. Nothing is designed for it, but nothing may break on it
      // either — it is where a layout that cannot shrink shows itself first.
      name: "phone-narrow",
      use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 568 }, hasTouch: true },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000/health",
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
