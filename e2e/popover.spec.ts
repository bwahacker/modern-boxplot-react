import { test, expect, type Page, type Locator } from '@playwright/test'

// These cover the interaction/layout bugs this library has actually shipped:
// a popover clipped instead of flipping above its anchor, and a hover
// tooltip getting stuck open when the cursor moves quickly between
// sparklines in a grid.

function sparklineFor(page: Page, datasetName: string): Locator {
  return page.locator('tr', { hasText: datasetName }).locator('svg')
}

function popover(page: Page): Locator {
  return page.locator('div[style*="z-index: 9999"]')
}

function backdrop(page: Page): Locator {
  return page.locator('div[style*="z-index: 9998"]')
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('text=Modern Box Plot')
})

test('clicking a sparkline opens its popover below the anchor when there is room', async ({ page }) => {
  const svg = sparklineFor(page, 'Patient ages')
  await svg.click()

  await expect(popover(page)).toBeVisible()
  const anchorBox = await svg.boundingBox()
  const popoverBox = await popover(page).boundingBox()
  expect(anchorBox).not.toBeNull()
  expect(popoverBox).not.toBeNull()
  expect(popoverBox!.y).toBeGreaterThan(anchorBox!.y)
})

test('popover flips above the anchor when there is no room below', async ({ page }) => {
  // Viewport comfortably taller than the popover itself, but positioned so
  // this specific anchor has little room below and plenty above.
  await page.setViewportSize({ width: 1200, height: 700 })
  const svg = sparklineFor(page, 'Wait times')
  await svg.evaluate(el => el.scrollIntoView({ block: 'end' }))
  await svg.click()

  await expect(popover(page)).toBeVisible()
  const anchorBox = await svg.boundingBox()
  const popoverBox = await popover(page).boundingBox()
  expect(anchorBox).not.toBeNull()
  expect(popoverBox).not.toBeNull()
  // The popover's bottom edge should sit at or above the anchor's top edge
  // (a small tolerance absorbs the gap/measurement rounding).
  expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(anchorBox!.y + 5)
})

test('clicking outside the popover closes it', async ({ page }) => {
  const svg = sparklineFor(page, 'Patient ages')
  await svg.click()
  await expect(popover(page)).toBeVisible()

  await backdrop(page).click({ position: { x: 5, y: 5 } })
  await expect(popover(page)).toBeHidden()
})

test('pressing Escape closes the popover', async ({ page }) => {
  const svg = sparklineFor(page, 'Patient ages')
  await svg.click()
  await expect(popover(page)).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(popover(page)).toBeHidden()
})

test('hovering a sparkline shows a tooltip after the hover delay', async ({ page }) => {
  const svg = sparklineFor(page, 'Patient ages')
  await svg.hover()

  const tooltip = page.locator('div[style*="pointer-events: none"]')
  await expect(tooltip).toBeVisible({ timeout: 2000 })
  await expect(tooltip).toContainText('mean')
})

test('hovering a second sparkline closes the first tooltip (only one active at a time)', async ({ page }) => {
  const first = sparklineFor(page, 'Patient ages')
  const second = sparklineFor(page, 'Response times')
  const tooltip = page.locator('div[style*="pointer-events: none"]')

  await first.hover()
  await expect(tooltip).toBeVisible({ timeout: 2000 })

  await second.hover()
  await expect(tooltip).toBeVisible({ timeout: 2000 })
  await expect(tooltip).toHaveCount(1)
})

test('opening a popover hides the hover tooltip', async ({ page }) => {
  const svg = sparklineFor(page, 'Patient ages')
  const tooltip = page.locator('div[style*="pointer-events: none"]')

  await svg.hover()
  await expect(tooltip).toBeVisible({ timeout: 2000 })

  await svg.click()
  await expect(popover(page)).toBeVisible()
  await expect(tooltip).toBeHidden()
})
