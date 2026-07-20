import { defineConfig } from '@playwright/test'

const PORT = 5183

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    command: `npx vite serve --config vite.demo.config.ts --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
})
