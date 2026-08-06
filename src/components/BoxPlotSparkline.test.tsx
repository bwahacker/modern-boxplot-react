import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { BoxPlotSparkline } from './BoxPlotSparkline'
import { fiveNumberSummary } from '../stats/descriptive'
import { fmtAxis } from '../format'
import { themes } from '../themes'

afterEach(cleanup)

const HIGHLIGHT_FILL = themes.tufte.colors.highlight!

function highlightPolygonX(container: HTMLElement): number {
  const poly = container.querySelector(`svg polygon[fill="${HIGHLIGHT_FILL}"]`)
  expect(poly).toBeTruthy()
  const points = poly!.getAttribute('points')!
  return parseFloat(points.split(' ')[0].split(',')[0])
}

describe('BoxPlotSparkline - highlight marker (numeric)', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('renders no highlight marker without highlightValue', () => {
    const { container } = render(<BoxPlotSparkline data={data} theme={themes.tufte} />)
    expect(container.querySelector(`svg polygon[fill="${HIGHLIGHT_FILL}"]`)).toBeNull()
  })

  // Proves the "shared scale" claim underlying the whole marker-append
  // approach: two structurally different rendering variants must place the
  // same highlightValue at the same x, since they both derive from one x()
  // closure despite very different visual geometry.
  it('places the highlight marker at the same x position across structurally different variants', () => {
    const { container: tufteContainer } = render(
      <BoxPlotSparkline data={data} variant="tufte" highlightValue={7} theme={themes.tufte} />,
    )
    const { container: violinContainer } = render(
      <BoxPlotSparkline data={data} variant="violin" highlightValue={7} theme={themes.tufte} />,
    )
    expect(highlightPolygonX(tufteContainer)).toBeCloseTo(highlightPolygonX(violinContainer), 5)
  })

  it('also renders the highlight marker on the small-N (2-3 point) path', () => {
    const { container } = render(
      <BoxPlotSparkline data={[10, 20, 30]} highlightValue={20} theme={themes.tufte} />,
    )
    expect(container.querySelector(`svg polygon[fill="${HIGHLIGHT_FILL}"]`)).toBeTruthy()
  })

  it('grows the svg height by a fixed amount and shows min/median/max tick text when showAxis is set', () => {
    const { container: base } = render(<BoxPlotSparkline data={data} theme={themes.tufte} size="md" />)
    const { container: withAxis } = render(<BoxPlotSparkline data={data} theme={themes.tufte} size="md" showAxis />)

    const baseHeight = Number(base.querySelector('svg')!.getAttribute('height'))
    const axisHeight = Number(withAxis.querySelector('svg')!.getAttribute('height'))
    expect(axisHeight - baseHeight).toBe(12)

    const fns = fiveNumberSummary(data)
    const texts = Array.from(withAxis.querySelectorAll('text')).map(t => t.textContent ?? '')
    expect(texts).toContain(fmtAxis(fns.min))
    expect(texts).toContain(fmtAxis(fns.median))
    expect(texts).toContain(fmtAxis(fns.max))
  })

  it('does not grow the svg height or show tick text without showAxis', () => {
    const { container } = render(<BoxPlotSparkline data={data} theme={themes.tufte} size="md" />)
    const fns = fiveNumberSummary(data)
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent ?? '')
    expect(texts).not.toContain(fmtAxis(fns.min))
  })

  it('auto-generates a neutral percentile label with no direction', () => {
    const { container } = render(<BoxPlotSparkline data={data} highlightValue={7} theme={themes.tufte} />)
    fireEvent.click(container.querySelector('svg')!)
    expect(document.body.textContent).toContain('Higher than')
    expect(document.body.textContent).toContain('% of peers')
  })

  it('flips the framing to "Better than" and inverts the percentile for direction=lowerIsBetter', () => {
    const { container } = render(
      <BoxPlotSparkline data={data} highlightValue={7} direction="lowerIsBetter" theme={themes.tufte} />,
    )
    fireEvent.click(container.querySelector('svg')!)
    // 7 is at the 65th percentile (mean rank) in 1..10; lowerIsBetter flips it to 35.
    expect(document.body.textContent).toContain('Better than 35% of peers')
  })

  it('uses an explicit highlightLabel verbatim, skipping percentile computation', () => {
    const { container } = render(
      <BoxPlotSparkline data={data} highlightValue={7} highlightLabel="Custom label" theme={themes.tufte} />,
    )
    fireEvent.click(container.querySelector('svg')!)
    expect(document.body.textContent).toContain('Custom label')
  })
})

describe('BoxPlotSparkline - highlight marker (categorical)', () => {
  it('marks the correct bar for highlightCategory', () => {
    const { container } = render(
      <BoxPlotSparkline data={['a', 'a', 'b', 'b', 'b', 'c']} highlightCategory="b" theme={themes.tufte} />,
    )
    expect(container.querySelector(`svg polygon[fill="${HIGHLIGHT_FILL}"]`)).toBeTruthy()
  })

  it('renders no highlight marker without highlightCategory', () => {
    const { container } = render(
      <BoxPlotSparkline data={['a', 'a', 'b', 'b', 'b', 'c']} theme={themes.tufte} />,
    )
    expect(container.querySelector(`svg polygon[fill="${HIGHLIGHT_FILL}"]`)).toBeNull()
  })
})
