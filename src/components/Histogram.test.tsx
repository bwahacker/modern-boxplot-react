import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Histogram } from './Histogram'
import { themes } from '../themes'

afterEach(cleanup)

describe('Histogram', () => {
  // Regression test: the summary-statistic markers (min/Q1/median/mean/Q3/max)
  // used to be dropped outright when their labels would overlap - e.g. mean
  // sitting right next to median. They should now stagger onto extra rows
  // instead of disappearing.
  it('keeps every marker label visible even when several collide', () => {
    // Symmetric 1..100: mean and median coincide almost exactly, guaranteeing
    // a collision at the default label spacing.
    const data = Array.from({ length: 100 }, (_, i) => i + 1)
    const { container } = render(<Histogram data={data} theme={themes.tufte} />)
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent)

    for (const label of ['min', 'Q1', 'median', 'mean', 'Q3', 'max']) {
      expect(texts).toContain(label)
    }
  })

  it('renders nothing for empty data without throwing', () => {
    const { container } = render(<Histogram data={[]} theme={themes.tufte} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})
