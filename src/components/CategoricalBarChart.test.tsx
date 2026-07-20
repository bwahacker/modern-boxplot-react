import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CategoricalBarChart } from './CategoricalBarChart'
import { categoricalSummary } from '../stats/categorical'
import { themes } from '../themes'

afterEach(cleanup)

// Regression coverage for overlapping per-bar count numbers and crowded,
// unreadable rotated axis labels on high-cardinality categorical charts
// (e.g. the "phone column, top 25 of 1.2M rows" scenario).
describe('CategoricalBarChart', () => {
  it('hides per-bar count labels and thins x-axis labels when bars are too narrow', () => {
    const counts = [37, 42, 45, 54, 56, 59, 69, 78, 107, 135, 259, 342, 629, 529, 293, 171, 120, 106, 73, 60, 59, 56, 51, 42, 39]
    const dict = Object.fromEntries(counts.map((c, i) => [`555-01${String(i).padStart(2, '0')}`, c]))
    const summary = categoricalSummary(dict)

    const { container } = render(
      <CategoricalBarChart summary={summary} width={420} height={220} theme={themes.tufte} />,
    )

    const barGroups = container.querySelectorAll('svg > g')
    expect(barGroups).toHaveLength(25)
    for (const g of barGroups) {
      expect(g.querySelector('text')).toBeNull() // no per-bar count label - would overlap
    }

    const axisLabels = container.querySelectorAll('svg > text')
    expect(axisLabels.length).toBeGreaterThan(0) // some labels still shown...
    expect(axisLabels.length).toBeLessThan(25) // ...but thinned out, not all 25
  })

  it('shows every count label and axis label when there is room', () => {
    const summary = categoricalSummary({ Critical: 5, High: 18, Medium: 45, Low: 30, Trivial: 12 })
    const { container } = render(
      <CategoricalBarChart summary={summary} width={420} height={220} theme={themes.tufte} />,
    )

    const barGroups = container.querySelectorAll('svg > g')
    expect(barGroups).toHaveLength(5)
    for (const g of barGroups) {
      expect(g.querySelector('text')).not.toBeNull() // count label present
    }

    const axisLabels = container.querySelectorAll('svg > text')
    expect(axisLabels).toHaveLength(5) // one per category, none thinned
  })

  it('renders nothing for an empty summary without throwing', () => {
    const summary = categoricalSummary({})
    const { container } = render(
      <CategoricalBarChart summary={summary} theme={themes.tufte} />,
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})
