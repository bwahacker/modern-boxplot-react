import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DistributionDiffSummary } from './DistributionDiffSummary'
import { themes } from '../themes'
import type { DescriptiveStats } from '../stats/descriptive'
import type { DistributionMatch } from '../stats/distribution-match'

afterEach(cleanup)

function makeStats(overrides: Partial<DescriptiveStats>): DescriptiveStats {
  return {
    min: 0, q1: 25, median: 50, q3: 75, max: 100,
    mean: 50, stddev: 20, variance: 400, skewness: 0, kurtosis: 0, n: 100, iqr: 50,
    ...overrides,
  }
}

function makeMatches(name: string, similarity: number): DistributionMatch[] {
  return [{ name, similarity, explanation: '', params: {} }]
}

describe('DistributionDiffSummary', () => {
  it('renders the delta table with correct labels and values', () => {
    const stats = makeStats({ n: 100, mean: 50 })
    const compareStats = makeStats({ n: 100, mean: 60 })
    render(
      <DistributionDiffSummary
        stats={stats} compareStats={compareStats}
        matches={makeMatches('Normal', 0.9)} compareMatches={makeMatches('Normal', 0.9)}
        theme={themes.tufte} label="Now" compareLabel="Before"
      />,
    )
    expect(screen.getByText('Now')).toBeTruthy()
    expect(screen.getByText('Before')).toBeTruthy()
    expect(screen.getByText(/\+10\.00 \(\+20%\)/)).toBeTruthy()
  })

  it('shows a shape-change narrative when the best match differs', () => {
    render(
      <DistributionDiffSummary
        stats={makeStats({})} compareStats={makeStats({})}
        matches={makeMatches('Log-Normal', 0.8)} compareMatches={makeMatches('Zero-inflated', 0.95)}
        theme={themes.tufte}
      />,
    )
    expect(screen.getByText(/Log-Normal.*Zero-inflated/)).toBeTruthy()
  })

  it('shows "Unchanged" when the best-fit shape is the same on both sides', () => {
    render(
      <DistributionDiffSummary
        stats={makeStats({})} compareStats={makeStats({})}
        matches={makeMatches('Normal', 0.9)} compareMatches={makeMatches('Normal', 0.85)}
        theme={themes.tufte}
      />,
    )
    expect(screen.getByText(/Unchanged: Normal/)).toBeTruthy()
  })
})
