import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CategoricalMatchCard } from './CategoricalMatchCard'
import { categoricalSummary } from '../stats/categorical'
import { themes } from '../themes'

afterEach(cleanup)

describe('CategoricalMatchCard', () => {
  it('uses a plain label with no caveat when not truncated', () => {
    const summary = categoricalSummary({ A: 5, B: 20, C: 5 })
    render(<CategoricalMatchCard summary={summary} theme={themes.tufte} />)

    expect(screen.getByText('Bell-curve fit')).toBeTruthy()
    expect(screen.queryByText(/computed from the categories shown only/i)).toBeNull()
  })

  it('labels the fit "(top N)" and appends a caveat when truncated', () => {
    const summary = categoricalSummary(
      { A: 37, B: 42, C: 45 },
      undefined,
      { totalCount: 1_469_403, uniqueCount: 182_004 },
    )
    render(<CategoricalMatchCard summary={summary} theme={themes.tufte} />)

    expect(screen.getByText('Bell-curve fit (top 3)')).toBeTruthy()
    expect(screen.getByText(/Computed from the categories shown only, not the full column\./)).toBeTruthy()
  })
})
