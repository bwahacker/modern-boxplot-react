import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DistributionMatchCard } from './DistributionMatchCard'
import { themes } from '../themes'
import type { DistributionMatch } from '../stats/distribution-match'

afterEach(cleanup)

function match(overrides: Partial<DistributionMatch>): DistributionMatch {
  return { name: 'Normal', similarity: 0.9, explanation: 'Looks normal.', params: {}, ...overrides }
}

describe('DistributionMatchCard', () => {
  it('presents a high-confidence match plainly, with no weak-fit caveat', () => {
    render(<DistributionMatchCard matches={[match({ similarity: 0.9 })]} theme={themes.tufte} />)
    expect(screen.getByText('Best match')).toBeTruthy()
    expect(screen.queryByText(/weak fit/i)).toBeNull()
    expect(screen.queryByText(/No standard shape fits/)).toBeNull()
  })

  // Regression test: a low-confidence "winner" (e.g. "Normal, 5% similarity"
  // picked only because every candidate scored badly) used to be presented
  // with the same confident styling as a genuine match.
  it('flags a low-confidence match instead of presenting it as a confident "Best match"', () => {
    render(<DistributionMatchCard matches={[match({ name: 'Normal', similarity: 0.05 })]} theme={themes.tufte} />)
    expect(screen.queryByText('Best match')).toBeNull()
    expect(screen.getByText(/Closest match.*weak fit/i)).toBeTruthy()
    expect(screen.getByText(/No standard shape fits this data well/)).toBeTruthy()
  })

  it('renders nothing for an empty match list', () => {
    const { container } = render(<DistributionMatchCard matches={[]} theme={themes.tufte} />)
    expect(container.firstChild).toBeNull()
  })
})
