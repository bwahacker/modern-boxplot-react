import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CategoricalDiffSummary } from './CategoricalDiffSummary'
import { categoricalSummary, mergedCategoryOrder } from '../stats/categorical'
import { themes } from '../themes'

afterEach(cleanup)

describe('CategoricalDiffSummary', () => {
  it('shows new/vanished categories and a mode-change callout', () => {
    // a (current) has Brave but not Edge; b (comparison) has Edge but not Brave.
    const a = { Chrome: 20, Safari: 55, Firefox: 10, Brave: 15 }
    const b = { Chrome: 60, Safari: 25, Firefox: 10, Edge: 5 }
    const order = mergedCategoryOrder(a, b)
    const summary = categoricalSummary(a, order)
    const compareSummary = categoricalSummary(b, order)

    render(
      <CategoricalDiffSummary summary={summary} compareSummary={compareSummary} theme={themes.tufte} label="Now" compareLabel="Before" />,
    )

    expect(screen.getByText(/"Safari".*"Chrome"/)).toBeTruthy()
    expect(screen.getByText(/Brave/)).toBeTruthy() // new: in current, not in baseline
    expect(screen.getByText(/Edge/)).toBeTruthy() // vanished: in baseline, not in current
  })

  it('shows "Unchanged" when the mode is the same on both sides', () => {
    const summary = categoricalSummary({ A: 10, B: 3 })
    const compareSummary = categoricalSummary({ A: 8, B: 3 })
    render(<CategoricalDiffSummary summary={summary} compareSummary={compareSummary} theme={themes.tufte} />)
    expect(screen.getByText(/Unchanged: "A"/)).toBeTruthy()
  })

  it('omits the truncation caveat when neither snapshot is truncated', () => {
    const summary = categoricalSummary({ A: 5, B: 3 })
    const compareSummary = categoricalSummary({ A: 5, B: 3 })
    render(<CategoricalDiffSummary summary={summary} compareSummary={compareSummary} theme={themes.tufte} />)
    expect(screen.queryByText(/only show/)).toBeNull()
  })

  it('shows the truncation caveat when either snapshot is truncated', () => {
    const summary = categoricalSummary({ A: 5, B: 3 })
    const compareSummary = categoricalSummary({ A: 5, B: 3 }, undefined, { totalCount: 1000, uniqueCount: 50 })
    render(<CategoricalDiffSummary summary={summary} compareSummary={compareSummary} theme={themes.tufte} />)
    expect(screen.getByText(/only show/)).toBeTruthy()
  })
})
