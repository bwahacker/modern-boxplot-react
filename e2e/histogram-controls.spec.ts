import { test, expect } from '@playwright/test'

// Covers the interactive histogram features that need a real browser (mouse
// coordinates via getBoundingClientRect, ResizeObserver for fullscreen) -
// drag-to-zoom, the log-scale toggle, and the fullscreen expand/collapse
// toggle, including the "chart steals clicks meant for the header buttons"
// layout bug found while building this.

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Modern Box Plot')
})

function popoverOf(page: import('@playwright/test').Page) {
  return page.locator('div[style*="z-index: 9999"]')
}

test('drag-to-zoom narrows the axis and "Reset zoom" becomes available', async ({ page }) => {
  const row = page.locator('tr', { hasText: 'Response times' })
  await row.locator('svg').click()

  const popover = popoverOf(page)
  const chart = popover.locator('svg').nth(1)
  const box = await chart.boundingBox()
  if (!box) throw new Error('chart not found')

  // Axis-tick text only, not marker labels - a marker group always has a
  // triangle <polygon> (min/Q1/median/mean/Q3/max always show the true
  // full-column range regardless of zoom, by design), while tick groups
  // don't. Uses textContent (via allTextContents), not innerText, since
  // innerText is layout/rendering-based and unreliable for SVG <text>.
  const tickLocator = chart.locator('g:not(:has(polygon)) > text')
  const tickTextsBefore = await tickLocator.allTextContents()
  const maxTickBefore = tickTextsBefore[tickTextsBefore.length - 1]

  await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()

  // The zoomed-in axis should no longer reach anywhere near the original max.
  const tickTextsAfter = await tickLocator.allTextContents()
  expect(tickTextsAfter).not.toContain(maxTickBefore)

  await popover.locator('button[aria-label="Chart options"]').click()
  await expect(popover.getByText('Reset zoom')).toBeVisible()
  await popover.getByText('Reset zoom').click()

  await popover.locator('button[aria-label="Chart options"]').click()
  await expect(popover.getByText('Reset zoom')).toHaveCount(0)
})

test('"Zoom to IQR" is disabled for zero-inflated data where Q1 equals Q3', async ({ page }) => {
  const row = page.locator('tr', { hasText: 'trailer_dryvan' })
  await row.locator('svg').click()

  const popover = popoverOf(page)
  await popover.locator('button[aria-label="Chart options"]').click()
  await expect(popover.getByText('Zoom to IQR')).toBeDisabled()
})

test('switching to Log scale changes the axis tick labels', async ({ page }) => {
  const row = page.locator('tr', { hasText: 'trailer_dryvan' })
  await row.locator('svg').click()

  const popover = popoverOf(page)
  await expect(popover).not.toContainText('0.10')

  await popover.locator('button[aria-label="Chart options"]').click()
  await popover.getByText(/^\s*Log$/).click()

  await expect(popover).toContainText('0.10')
})

test('Full screen expands the popover and Exit full screen collapses it back', async ({ page }) => {
  // This dataset has no `title` prop, which previously left the chart
  // overlapping (and stealing clicks from) the header buttons.
  const row = page.locator('tr', { hasText: 'trailer_dryvan' })
  await row.locator('svg').click()

  const popover = popoverOf(page)
  const before = await popover.boundingBox()

  await popover.locator('button[aria-label="Full screen"]').click({ timeout: 5000 })
  const expanded = await popover.boundingBox()
  expect(expanded!.width).toBeGreaterThan(before!.width * 1.5)

  await popover.locator('button[aria-label="Exit full screen"]').click({ timeout: 5000 })
  const collapsed = await popover.boundingBox()
  expect(collapsed!.width).toBeLessThan(expanded!.width)
})
