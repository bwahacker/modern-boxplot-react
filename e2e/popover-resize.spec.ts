import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureUrl = 'file://' + resolve(__dirname, 'fixtures/standalone.html')

// Regression test: a popover with enough content to need scroll-clamping
// (e.g. a categorical column with ~40 distinct values, producing a long
// frequency table) used to render once at its full unconstrained height,
// then immediately snap to the correct clamped height on the next frame -
// a visible "flash" reported from a customer report card with a wide
// categorical column. Root cause: the popover measured its own height in a
// plain useEffect (which runs after the browser paints), so the wrong,
// pre-measurement layout was actually painted for one frame before being
// corrected. Fixed by measuring in useLayoutEffect instead, so the
// correction happens before paint and only the final size is ever shown.
test('a popover with many categories does not flash between two sizes when it opens', async ({ page }) => {
  const loopWarnings: string[] = []
  page.on('console', msg => {
    if (/ResizeObserver loop/i.test(msg.text())) loopWarnings.push(msg.text())
  })

  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto(fixtureUrl)

  const container = page.locator('#many-categories')

  // Record every animation frame's popover size for ~1s, starting the
  // recorder BEFORE the click so the very first paint is captured - a
  // Playwright round-trip after the click has enough latency to skip past
  // a one-frame flash entirely.
  const recordPromise = page.evaluate(() => {
    return new Promise<{ w: number; h: number }[]>(resolve => {
      const samples: { w: number; h: number }[] = []
      const start = performance.now()
      function tick() {
        const el = document.querySelector('div[style*="z-index: 9999"]') as HTMLElement | null
        if (el) {
          const r = el.getBoundingClientRect()
          samples.push({ w: Math.round(r.width), h: Math.round(r.height) })
        }
        if (performance.now() - start < 1000) {
          requestAnimationFrame(tick)
        } else {
          resolve(samples)
        }
      }
      requestAnimationFrame(tick)
    })
  })

  await container.locator('svg').first().click()
  const samples = await recordPromise

  const popover = page.locator('div[style*="z-index: 9999"]')
  await expect(popover).toBeVisible()

  const distinctSizes = new Set(samples.map(s => `${s.w}x${s.h}`))
  expect(loopWarnings).toEqual([])
  expect(distinctSizes.size).toBe(1)
})
