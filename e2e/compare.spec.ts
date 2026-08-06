import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureUrl = 'file://' + resolve(__dirname, 'fixtures/standalone.html')

function popoverOf(page: import('@playwright/test').Page) {
  return page.locator('div[style*="z-index: 9999"]')
}

test.describe('comparison mode - React demo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Modern Box Plot')
  })

  test('numeric comparison shows both labels, a delta table, and the shape line', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'API latency (week vs week)' })
    await row.locator('svg').click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()

    expect(text).toContain('This week')
    expect(text).toContain('Last week')
    expect(text).toMatch(/mean\s+\d/i)
    expect(text.toLowerCase()).toContain('shape')
  })

  test('categorical comparison shows mode change and new/vanished categories', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'Browser share (month vs month)' })
    await row.locator('svg').click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()

    expect(text).toContain('This month')
    expect(text).toContain('Last month')
    expect(text.toUpperCase()).toContain('NEW CATEGORIES')
    expect(text).toContain('Brave') // new: present this month, not last month
    expect(text.toUpperCase()).toContain('VANISHED CATEGORIES')
    expect(text).toContain('Edge') // vanished: present last month, not this month
  })

  test('a non-comparing dataset still opens its plain single-snapshot popover', async ({ page }) => {
    const row = page.locator('tr', { hasText: 'Response times' }).first()
    await row.locator('svg').click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()

    expect(text.toUpperCase()).toContain('BEST MATCH')
    expect(text).not.toContain('This week')
  })
})

test.describe('comparison mode - standalone bundle (production path)', () => {
  test('numeric data-compare-values flows through to the popover', async ({ page }) => {
    await page.goto(fixtureUrl)

    const container = page.locator('#numeric-compare')
    await container.locator('svg').click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()

    expect(text).toContain('Now')
    expect(text).toContain('Before')
    expect(text.toLowerCase()).toContain('shape')
  })

  test('categorical data-compare-values flows through to the popover', async ({ page }) => {
    await page.goto(fixtureUrl)

    const container = page.locator('#categorical-compare')
    await container.locator('svg').click()

    const popover = popoverOf(page)
    await expect(popover).toBeVisible()
    const text = await popover.innerText()

    expect(text).toContain('Now')
    expect(text).toContain('Before')
    expect(text.toUpperCase()).toContain('MODE')
  })
})
