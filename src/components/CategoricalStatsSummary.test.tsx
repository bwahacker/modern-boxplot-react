import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { CategoricalStatsSummary } from './CategoricalStatsSummary'
import { categoricalSummary } from '../stats/categorical'
import { themes } from '../themes'

afterEach(cleanup)

// The frequency table repeats individual category counts/labels, so scope
// stat-cell assertions to the metrics grid to avoid colliding with them
// (e.g. a category's own count happening to equal numCategories).
function getMetricsGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector('div[style*="grid-template-columns"]')
  if (!grid) throw new Error('metrics grid not found')
  return grid as HTMLElement
}

// Regression coverage for the "N mislabeled as sum of top-25 categories" bug,
// at the rendered-component level (src/stats/categorical.test.ts already
// covers the pure categoricalSummary() computation).
describe('CategoricalStatsSummary', () => {
  it('shows the shown-data sum as N/categories and plain labels when not truncated', () => {
    const summary = categoricalSummary({ A: 3, B: 7, C: 2 })
    const { container } = render(<CategoricalStatsSummary summary={summary} theme={themes.tufte} />)
    const grid = within(getMetricsGrid(container))

    expect(grid.getByText('12')).toBeTruthy() // N
    expect(grid.getByText('3')).toBeTruthy() // categories
    expect(grid.getByText('B')).toBeTruthy() // mode
    expect(grid.getByText('entropy')).toBeTruthy() // plain label, no "(top N)"
    expect(screen.queryByText(/Showing top/)).toBeNull()
  })

  it('shows the true total/unique counts and a truncation caveat when truncated', () => {
    const summary = categoricalSummary(
      { A: 37, B: 42, C: 45 },
      undefined,
      { totalCount: 1_469_403, uniqueCount: 182_004 },
    )
    const { container } = render(<CategoricalStatsSummary summary={summary} theme={themes.tufte} />)
    const grid = within(getMetricsGrid(container))

    expect(grid.getByText('1,469,403')).toBeTruthy() // true N, not the shown sum (124)
    expect(grid.getByText('182,004')).toBeTruthy() // true unique count, not 3
    expect(grid.getByText('entropy (top 3)')).toBeTruthy()
    expect(screen.getByText(/Showing top 3 of 182,004 categories/)).toBeTruthy()
    // The old, wrong value (sum of the shown slice) must never appear as the N stat.
    expect(grid.queryByText('124')).toBeNull()
  })
})
