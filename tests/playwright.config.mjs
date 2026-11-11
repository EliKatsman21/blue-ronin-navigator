import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", locale: "he-IL", timezoneId: "Asia/Jerusalem", geolocation: { latitude: 32.651, longitude: 35.105 }, permissions: ["geolocation"], serviceWorkers: "block" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: { command: "node serve.mjs", url: "http://localhost:4173/index.html", reuseExistingServer: true, timeout: 15_000 },
});
