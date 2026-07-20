import { test, expect } from '@playwright/test'

// End-to-end regression coverage (through real props -> DOM rendering, not
// just the pure categoricalSummary() unit test) for the bug where a modal
// mislabeled the sum of a truncated top-25 category dict as the column's
// true N. Mirrors the exact "phone column, top 25 of 1.2M rows" scenario
// from the original bug report.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Modern Box Plot')
})

test('truncated categorical data shows the true N/categories, not the shown-slice sum', async ({ page }) => {
  const row = page.locator('tr', { hasText: 'Phone (top 25)' })
  await row.locator('svg').click()

  const popover = page.locator('div[style*="z-index: 9999"]')
  await expect(popover).toBeVisible()
  const text = await popover.innerText()

  expect(text).toContain('1,469,403') // true N
  expect(text).toContain('182,004') // true unique count
  expect(text).toContain('ENTROPY (TOP 25)')
  expect(text).toContain('BELL-CURVE FIT (TOP 25)')
  expect(text).toMatch(/Showing top 25 of 182,004 categories/)
})

test('a non-truncated categorical dataset shows plain labels with no caveat', async ({ page }) => {
  const row = page.locator('tr', { hasText: 'Language popularity' })
  await row.locator('svg').click()

  const popover = page.locator('div[style*="z-index: 9999"]')
  await expect(popover).toBeVisible()
  const text = await popover.innerText()

  expect(text).toContain('ENTROPY')
  expect(text).not.toContain('ENTROPY (TOP')
  expect(text).not.toMatch(/Showing top/)
})
