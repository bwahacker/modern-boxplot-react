// One-off screenshot generator for README.md marketing shots. Not part of
// the test suite - run manually with `node scripts/generate-screenshots.mjs`
// against the demo dev server (npx vite serve --config vite.demo.config.ts
// --port 5183 --strictPort).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '../docs/screenshots')
mkdirSync(OUT, { recursive: true })
const BASE = 'http://localhost:5183'

function row(page, name) {
  return page.locator('tr', { hasText: name }).first()
}
function svgOf(locator) {
  return locator.locator('svg').first()
}
function popover(page) {
  return page.locator('div[style*="z-index: 9999"]')
}
async function openPopover(page, name) {
  await svgOf(row(page, name)).click()
  const p = popover(page)
  await p.waitFor({ state: 'visible' })
  await page.waitForTimeout(250) // let the 0.15s open animation settle
  return p
}
async function closePopover(page) {
  await page.keyboard.press('Escape')
  await popover(page).waitFor({ state: 'hidden' }).catch(() => {})
}
async function selectPicker(page, groupLabel, optionLabel) {
  const label = page.getByText(groupLabel, { exact: true })
  const buttons = label.locator('xpath=following-sibling::div[1]')
  await buttons.getByRole('button', { name: optionLabel, exact: true }).click()
}
async function openChartOptions(popoverLocator) {
  await popoverLocator.locator('button[aria-label="Chart options"]').click()
}

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })

  await page.goto(BASE + '/')
  await page.waitForSelector('text=Modern Box Plot')
  // Kill CSS transitions/animations globally so every screenshot is captured
  // at its final resting state, not mid-fade.
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation-duration: 0.001s !important; }' })

  const numericTable = page.locator('table').first()
  const categoricalTable = page.locator('table').nth(1)

  // ── 1. Hero: the numeric report table, tufte/md/light (default) ───────
  await numericTable.screenshot({ path: `${OUT}/hero-table.png` })
  console.log('hero-table.png')

  // ── 2. Full-viewport "click to explore" interaction shot ───────────────
  await openPopover(page, 'Response times')
  await page.screenshot({ path: `${OUT}/interaction-click-to-explore.png` })
  console.log('interaction-click-to-explore.png')

  // ── 3. Popover-only crop: log-normal distribution match ────────────────
  await popover(page).screenshot({ path: `${OUT}/popover-lognormal.png` })
  console.log('popover-lognormal.png')
  await closePopover(page)

  // ── 4. Zero-inflated: linear (misleading) vs log (revealing) ───────────
  const zi = await openPopover(page, 'trailer_dryvan')
  await zi.screenshot({ path: `${OUT}/zero-inflated-linear.png` })
  console.log('zero-inflated-linear.png')
  await openChartOptions(zi)
  await zi.getByText(/^\s*Log$/).click()
  await page.waitForTimeout(200)
  await zi.screenshot({ path: `${OUT}/zero-inflated-log.png` })
  console.log('zero-inflated-log.png')
  await closePopover(page)

  // ── 5. Full screen mode ─────────────────────────────────────────────────
  const fs = await openPopover(page, 'trailer_dryvan')
  await fs.locator('button[aria-label="Full screen"]').click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${OUT}/fullscreen.png` })
  console.log('fullscreen.png')
  await closePopover(page)

  // ── 6-10: content-heavy popovers. Use a tall viewport and scroll the
  // anchor row to the very top first, so the popover has enough space below
  // it to render at full natural height instead of self-clamping into an
  // internal scroll (which would clip the screenshot mid-content).
  await page.setViewportSize({ width: 1280, height: 2400 })

  async function openPopoverTall(name) {
    const r = row(page, name)
    await r.evaluate(el => el.scrollIntoView({ block: 'start' }))
    await page.waitForTimeout(50)
    await svgOf(r).click()
    const p = popover(page)
    await p.waitFor({ state: 'visible' })
    await page.waitForTimeout(250)
    return p
  }

  // 6. Comparison mode: numeric (mean shift)
  const cmp = await openPopoverTall('API latency (week vs week)')
  await cmp.screenshot({ path: `${OUT}/comparison-numeric.png` })
  console.log('comparison-numeric.png')
  await closePopover(page)

  // 7. Comparison mode: categorical (new/vanished categories)
  const cmpCat = await openPopoverTall('Browser share (month vs month)')
  await cmpCat.screenshot({ path: `${OUT}/comparison-categorical.png` })
  console.log('comparison-categorical.png')
  await closePopover(page)

  // 8. Report-card highlight: "Better than X% of peers"
  const hl = await openPopoverTall('Server response (this request)')
  await hl.screenshot({ path: `${OUT}/highlight-report-card.png` })
  console.log('highlight-report-card.png')
  await closePopover(page)

  // 9. Categorical distribution (Likert-style survey)
  const catPop = await openPopoverTall('Satisfaction survey')
  await catPop.screenshot({ path: `${OUT}/categorical-survey.png` })
  console.log('categorical-survey.png')
  await closePopover(page)

  // 10. Truncated categorical: honest about sampled big data
  const truncPop = await openPopoverTall('Phone (top 25)')
  await truncPop.screenshot({ path: `${OUT}/categorical-truncated.png` })
  console.log('categorical-truncated.png')
  await closePopover(page)

  await page.setViewportSize({ width: 1280, height: 1000 })

  // ── 11. Variant gallery: same dataset, 6 rendering styles, tight crops ──
  await selectPicker(page, 'Size', 'L')
  const variantRow = row(page, 'Response times')
  const variants = ['Tufte', 'Classic', 'Minimal', 'Lollipop', 'Gradient', 'Violin']
  for (const v of variants) {
    await selectPicker(page, 'Style', v)
    await page.waitForTimeout(100)
    await svgOf(variantRow).screenshot({ path: `${OUT}/variant-${v.toLowerCase()}.png` })
  }
  console.log('variant-*.png (6)')
  await selectPicker(page, 'Style', 'Tufte')
  await selectPicker(page, 'Size', 'M')

  // ── 12. Theme gallery: header + first 3 data rows, 4 themes ─────────────
  async function tableSwatch(path) {
    const tBox = await numericTable.boundingBox()
    const cutoffRow = numericTable.locator('tr').nth(3)
    const rBox = await cutoffRow.boundingBox()
    await page.screenshot({
      path,
      clip: { x: tBox.x, y: tBox.y, width: tBox.width, height: rBox.y + rBox.height - tBox.y },
    })
  }
  const themeList = ['Tufte', 'Dark', 'Blueprint', 'Warm']
  for (const th of themeList) {
    await selectPicker(page, 'Theme', th)
    await page.waitForTimeout(100)
    await tableSwatch(`${OUT}/theme-${th.toLowerCase()}.png`)
  }
  console.log('theme-*.png (4)')
  await selectPicker(page, 'Theme', 'Tufte')

  await browser.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
