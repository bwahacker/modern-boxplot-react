import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureUrl = 'file://' + resolve(__dirname, 'fixtures/standalone.html')

function popoverOf(page: import('@playwright/test').Page) {
  return page.locator('div[style*="z-index: 9999"]')
}

test.describe('highlight value/category - React demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Modern Box Plot')
  })

  test('numeric highlightValue + direction shows resolved percentile wording in the popover', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'Server response (this request)' })
    await row.locator('svg').click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()

    expect(text).toContain('Better than')
    expect(text).toContain('% of peers')
  })

  test('categorical highlightCategory opens its popover without error', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'Support tickets (flagged' })
    await row.locator('svg').click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()
    expect(text).toContain('High')
  })
})

test.describe('highlight value/category - standalone bundle (production path)', () => {
  test('data-highlight-value + data-direction + data-show-axis flow through to the popover and compact glyph', async ({ page }) => {
    await page.goto(fixtureUrl)

    const container = page.locator('#numeric-highlight')
    // showAxis grows the compact sparkline's own svg - not just the popover's.
    const compactSvgHeight = await container.locator('svg').first().getAttribute('height')
    expect(Number(compactSvgHeight)).toBeGreaterThan(24) // taller than the default md preset (24px)

    await container.locator('svg').first().click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()
    expect(text).toContain('Better than')
    expect(text).toContain('% of peers')
  })

  test('data-highlight-category flows through and opens the popover', async ({ page }) => {
    await page.goto(fixtureUrl)

    const container = page.locator('#categorical-highlight')
    await container.locator('svg').first().click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()
    expect(text).toContain('Safari')
  })
})
