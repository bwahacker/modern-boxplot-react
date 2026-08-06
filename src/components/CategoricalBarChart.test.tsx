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

  it('does not show the Gaussian fit curve by default (it reads as clutter on real data)', () => {
    const summary = categoricalSummary({ a: 5, b: 20, c: 70, d: 20, e: 5 }, ['a', 'b', 'c', 'd', 'e'])
    const { container } = render(
      <CategoricalBarChart summary={summary} theme={themes.tufte} />,
    )
    expect(container.querySelectorAll('svg > path')).toHaveLength(0)
  })

  it('shows the Gaussian fit curve when showFitCurve is explicitly set', () => {
    const summary = categoricalSummary({ a: 5, b: 20, c: 70, d: 20, e: 5 }, ['a', 'b', 'c', 'd', 'e'])
    const { container } = render(
      <CategoricalBarChart summary={summary} theme={themes.tufte} showFitCurve />,
    )
    expect(container.querySelectorAll('svg > path').length).toBeGreaterThan(0)
  })

  it('renders nothing for an empty summary without throwing', () => {
    const summary = categoricalSummary({})
    const { container } = render(
      <CategoricalBarChart summary={summary} theme={themes.tufte} />,
    )
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('CategoricalBarChart - comparison mode', () => {
  it('renders two bars per category (primary + compare) and a legend', () => {
    const summary = categoricalSummary({ A: 10, B: 20 })
    const compareSummary = categoricalSummary({ A: 15, B: 15 })
    const { container } = render(
      <CategoricalBarChart
        summary={summary} compareSummary={compareSummary} width={420} height={220} theme={themes.tufte}
        label="Now" compareLabel="Before"
      />,
    )

    const barGroups = container.querySelectorAll('svg > g')
    expect(barGroups).toHaveLength(2) // one group per category
    for (const g of barGroups) {
      expect(g.querySelectorAll('rect')).toHaveLength(2) // primary + compare bar
    }

    // The legend is an HTML overlay (flexbox), not SVG text - it reflows
    // naturally instead of relying on a hardcoded x-offset that overlapped
    // the second label whenever the first one ran long.
    expect(container.textContent).toContain('Now')
    expect(container.textContent).toContain('Before')
  })

  // Regression test: the legend used to be two SVG <text> elements with a
  // hardcoded x-offset for the second one (x = pad.left + 90), which visibly
  // overlapped the first label whenever it ran longer than ~15 characters
  // (found by screenshotting a "Production Environment (v2.3.1)" label).
  it('does not overlap the legend labels when they are long', () => {
    const summary = categoricalSummary({ A: 10, B: 20 })
    const compareSummary = categoricalSummary({ A: 15, B: 15 })
    const { container } = render(
      <CategoricalBarChart
        summary={summary} compareSummary={compareSummary} theme={themes.tufte}
        label="Production Environment (v2.3.1)" compareLabel="Staging Environment (v2.3.0-rc4)"
      />,
    )

    // No hardcoded-offset SVG text nodes for the legend at all anymore.
    const svgTexts = Array.from(container.querySelectorAll('svg > text')).map(t => t.textContent ?? '')
    expect(svgTexts.some(t => t.includes('Production'))).toBe(false)

    expect(container.textContent).toContain('Production Environment (v2.3.1)')
    expect(container.textContent).toContain('Staging Environment (v2.3.0-rc4)')
  })

  it('suppresses the Gaussian fit curve when comparing', () => {
    const summary = categoricalSummary({ a: 5, b: 20, c: 70, d: 20, e: 5 }, ['a', 'b', 'c', 'd', 'e'])
    const compareSummary = categoricalSummary({ a: 5, b: 20, c: 70, d: 20, e: 5 }, ['a', 'b', 'c', 'd', 'e'])
    const { container } = render(
      <CategoricalBarChart summary={summary} compareSummary={compareSummary} theme={themes.tufte} />,
    )
    // The fit curve is a direct child <path> of the svg (bars/legend are the
    // only other direct children besides text/lines).
    expect(container.querySelectorAll('svg > path')).toHaveLength(0)
  })
})

describe('CategoricalBarChart - highlight marker', () => {
  it('marks the right bar and shows the label text', () => {
    const summary = categoricalSummary({ Critical: 5, High: 18, Medium: 45, Low: 30, Trivial: 12 })
    const { container } = render(
      <CategoricalBarChart
        summary={summary} theme={themes.tufte}
        highlightCategory="High" highlightLabel="Flagged ticket"
      />,
    )
    expect(container.textContent).toContain('Flagged ticket')
    // One polygon for the highlight flag, beyond whatever isMode bar styling adds.
    expect(container.querySelectorAll('svg polygon').length).toBeGreaterThan(0)
  })

  it('renders no highlight marker without highlightCategory', () => {
    const summary = categoricalSummary({ Critical: 5, High: 18, Medium: 45, Low: 30, Trivial: 12 })
    const { container } = render(<CategoricalBarChart summary={summary} theme={themes.tufte} />)
    expect(container.querySelectorAll('svg polygon')).toHaveLength(0)
  })

  // Regression test: mirrors the identical bug found and fixed in Histogram -
  // the highlight label and the compare legend both anchored near y:0 and
  // overlapped whenever both were shown together.
  it('does not overlap the compare legend when both are shown', () => {
    const summary = categoricalSummary({ A: 10, B: 20 })
    const compareSummary = categoricalSummary({ A: 15, B: 15 })
    const { container } = render(
      <CategoricalBarChart
        summary={summary} compareSummary={compareSummary} theme={themes.tufte}
        label="Now" compareLabel="Before"
        highlightCategory="A" highlightLabel="Flagged: acct #4821"
      />,
    )
    const highlightText = Array.from(container.querySelectorAll('svg text'))
      .find(t => t.textContent === 'Flagged: acct #4821')
    expect(highlightText).toBeTruthy()
    expect(container.textContent).toContain('Before')
    expect(Number(highlightText!.getAttribute('y'))).toBeGreaterThan(20)
  })

  // Regression guard: the highlight flag must coexist with isMode's bold-bar
  // styling rather than one clobbering the other, when the same category is
  // both the mode and the highlight.
  it('coexists with isMode styling when the highlighted category is also the mode', () => {
    const summary = categoricalSummary({ Critical: 5, High: 18, Medium: 45, Low: 30, Trivial: 12 })
    const { container } = render(
      <CategoricalBarChart summary={summary} theme={themes.tufte} highlightCategory="Medium" />,
    )
    // The mode bar still renders filled with the primary color...
    const modeBar = Array.from(container.querySelectorAll('rect')).find(r => r.getAttribute('fill') === themes.tufte.colors.primary)
    expect(modeBar).toBeTruthy()
    // ...and the highlight flag is still drawn.
    expect(container.querySelectorAll('svg polygon').length).toBeGreaterThan(0)
  })
})
