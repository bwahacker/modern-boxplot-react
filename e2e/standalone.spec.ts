import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureUrl = 'file://' + resolve(__dirname, 'fixtures/standalone.html')

// Smoke test for the actual artifact consumed outside this repo (built as
// dist/modern-boxplot.standalone.js and loaded via a plain <script> tag with
// data-* attributes, e.g. by taco-fixes' data_quality_report.py). Requires
// `npm run build:standalone` to have produced dist/modern-boxplot.standalone.js
// (the `test:e2e` script does this before invoking Playwright).

test('renderAll() picks up [data-boxplot] elements and renders an SVG for each', async ({ page }) => {
  await page.goto(fixtureUrl)
  await expect(page.locator('svg')).toHaveCount(2)
})

test('data-true-total-count / data-true-unique-count flow through to the popover', async ({ page }) => {
  await page.goto(fixtureUrl)

  const container = page.locator('div[data-true-total-count="1469403"]')
  await container.locator('svg').click()

  const popover = page.locator('div[style*="z-index: 9999"]')
  await expect(popover).toBeVisible()
  const text = await popover.innerText()

  expect(text).toContain('1,469,403') // true N from the data attribute, not the shown sum (6)
  expect(text).toContain('182,004') // true unique count, not 3
  expect(text.toLowerCase()).toContain('top 3') // entropy/bell-curve labeled over the shown subset
})
