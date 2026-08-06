import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
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
    // a collision at the default label spacing (they display as the same
    // rounded value, so they're combined into one label rather than staggered).
    const data = Array.from({ length: 100 }, (_, i) => i + 1)
    const { container } = render(<Histogram data={data} theme={themes.tufte} />)
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent ?? '')

    for (const label of ['min', 'Q1', 'median', 'mean', 'Q3', 'max']) {
      expect(texts.some(t => t.includes(label))).toBe(true)
    }
  })

  it('combines markers that display the same rounded value into one label instead of stacking rows', () => {
    // Zero-inflated: min/Q1/median/Q3 are all exactly 0.
    const data = [...Array(190).fill(0), ...Array(10).fill(0).map((_, i) => (i + 1) * 40)]
    const { container } = render(<Histogram data={data} theme={themes.tufte} />)
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent ?? '')

    expect(texts.some(t => t.includes('min') && t.includes('Q1') && t.includes('median'))).toBe(true)
    // No separate, standalone "Q1" or "median" label alongside the combined one.
    expect(texts).not.toContain('Q1')
    expect(texts).not.toContain('median')
  })

  it('renders nothing for empty data without throwing', () => {
    const { container } = render(<Histogram data={[]} theme={themes.tufte} />)
    expect(container.querySelector('svg')).toBeNull()
  })
})

describe('Histogram options menu', () => {
  it('opens on hamburger click and closes on an outside click', () => {
    render(<Histogram data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} theme={themes.tufte} />)
    expect(screen.queryByText(/Linear/)).toBeNull()

    fireEvent.click(screen.getByLabelText('Chart options'))
    expect(screen.getByText(/Linear/)).toBeTruthy()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByText(/Linear/)).toBeNull()
  })

  it('disables "Zoom to IQR" when Q1 equals Q3', () => {
    const data = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1] // Q1 = Q3 = 0 for this skew
    render(<Histogram data={data} theme={themes.tufte} />)
    fireEvent.click(screen.getByLabelText('Chart options'))
    const btn = screen.getByText('Zoom to IQR') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('applies "Zoom to IQR" and lets "Reset zoom" revert it', () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1) // Q1 != Q3
    render(<Histogram data={data} theme={themes.tufte} />)

    fireEvent.click(screen.getByLabelText('Chart options'))
    expect(screen.queryByText('Reset zoom')).toBeNull()
    fireEvent.click(screen.getByText('Zoom to IQR'))

    fireEvent.click(screen.getByLabelText('Chart options'))
    expect(screen.getByText('Reset zoom')).toBeTruthy()
    fireEvent.click(screen.getByText('Reset zoom'))

    fireEvent.click(screen.getByLabelText('Chart options'))
    expect(screen.queryByText('Reset zoom')).toBeNull()
  })

  it('switches scale mode and reflects the active choice', () => {
    render(<Histogram data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} theme={themes.tufte} />)

    fireEvent.click(screen.getByLabelText('Chart options'))
    fireEvent.click(screen.getByText(/Log/))

    fireEvent.click(screen.getByLabelText('Chart options'))
    expect(screen.getByText(/✓\s*Log/)).toBeTruthy()
  })
})

describe('Histogram - comparison mode', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  const compareData = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

  it('shows a legend with both labels when compareData is provided', () => {
    render(<Histogram data={data} compareData={compareData} label="Now" compareLabel="Before" theme={themes.tufte} />)
    expect(screen.getByText(/Now/)).toBeTruthy()
    expect(screen.getByText(/Before/)).toBeTruthy()
  })

  it('does not show a legend when not comparing', () => {
    render(<Histogram data={data} theme={themes.tufte} />)
    expect(screen.queryByText(/Comparison/)).toBeNull()
  })

  it('draws a dashed compare KDE line and dashed compare bars', () => {
    const { container } = render(<Histogram data={data} compareData={compareData} theme={themes.tufte} />)
    expect(container.querySelectorAll('path[stroke-dasharray]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('rect[stroke-dasharray]').length).toBeGreaterThan(0)
  })

  // Regression test: with two datasets, up to 12 individual marker labels
  // would fight for space on top of a mechanism already built to stagger
  // collisions for *one* dataset - they're suppressed entirely in favor of
  // the dual box-plot strip and the separate diff summary card.
  it('suppresses individual min/Q1/median/mean/Q3/max markers when comparing', () => {
    const { container } = render(<Histogram data={data} compareData={compareData} theme={themes.tufte} />)
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent ?? '')
    expect(texts).not.toContain('min')
    expect(texts).not.toContain('median')
    expect(texts).not.toContain('max')
  })

  it('still shows markers when not comparing (no behavior change)', () => {
    const { container } = render(<Histogram data={data} theme={themes.tufte} />)
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent ?? '')
    expect(texts).toContain('min')
  })
})

describe('Histogram - highlight marker', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('renders a highlight label when highlightValue is given', () => {
    render(<Histogram data={data} highlightValue={7} highlightLabel="Better than 82% of peers" theme={themes.tufte} />)
    expect(screen.getByText('Better than 82% of peers')).toBeTruthy()
  })

  it('renders nothing extra without highlightValue', () => {
    render(<Histogram data={data} theme={themes.tufte} />)
    expect(screen.queryByText(/of peers/)).toBeNull()
  })

  // Regression guard: the six base stat markers are unconditionally suppressed
  // when comparing (`isComparing ? [] : [...]`) - the highlight marker must
  // not fall into that same suppression, since it's a single external
  // reference point rather than a redundant per-dataset stat.
  it('still renders the highlight marker when compareData is also present', () => {
    const compareData = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    render(
      <Histogram
        data={data} compareData={compareData}
        highlightValue={7} highlightLabel="Better than 82% of peers"
        theme={themes.tufte}
      />,
    )
    expect(screen.getByText('Better than 82% of peers')).toBeTruthy()
  })

  // Regression test: the highlight label and the compare legend both used to
  // anchor near y:0, and overlapped whenever both were shown at once (found
  // by screenshotting a highlightValue+compareData combination) - the
  // highlight strip must be pushed below the legend's own footprint.
  it('does not overlap the compare legend when both are shown', () => {
    const compareData = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const { container } = render(
      <Histogram
        data={data} compareData={compareData} label="Now" compareLabel="Before"
        highlightValue={7} highlightLabel="Better than 82% of peers"
        theme={themes.tufte}
      />,
    )
    const highlightText = Array.from(container.querySelectorAll('svg text'))
      .find(t => t.textContent === 'Better than 82% of peers')
    expect(highlightText).toBeTruthy()
    const highlightY = Number(highlightText!.getAttribute('y'))
    // The legend is an HTML overlay outside the SVG entirely (asserted via
    // the legend text existing in the DOM at all), so the only thing to
    // check inside the SVG is that the highlight label was pushed down well
    // past the legend's own ~14px footprint.
    expect(container.textContent).toContain('Before')
    expect(highlightY).toBeGreaterThan(20)
  })

  // Regression guard: a highlight value that displays the same rounded value
  // as an existing stat marker (e.g. the median) must still render as its
  // own distinct marker, not get folded into the same-display-value grouping
  // built for zero-inflated/tied data.
  it('does not merge into the same-display-value grouping when it coincides with the median', () => {
    const { container } = render(
      <Histogram data={data} highlightValue={5.5} highlightLabel="Right at the median" theme={themes.tufte} />,
    )
    const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent ?? '')
    // Median (and mean, which also lands on 5.5 for this symmetric data) still
    // shows its own combined stat-marker label, as a text node distinct from
    // the highlight's - not folded together into one label string.
    expect(texts.some(t => t.includes('median') && !t.includes('Right at the median'))).toBe(true)
    expect(texts.some(t => t.includes('Right at the median'))).toBe(true)
  })
})

describe('Histogram - density curve toggle', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('renders the KDE curve by default', () => {
    const { container } = render(<Histogram data={data} theme={themes.tufte} />)
    expect(container.querySelector('path')).toBeTruthy()
  })

  it('renders no curve when showDensityCurve is false - for small/sparse samples where a smoothed curve overstates the data', () => {
    const { container } = render(<Histogram data={data} theme={themes.tufte} showDensityCurve={false} />)
    expect(container.querySelector('path')).toBeNull()
  })

  it('also hides the compare curve when showDensityCurve is false', () => {
    const compareData = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
    const { container } = render(
      <Histogram data={data} compareData={compareData} theme={themes.tufte} showDensityCurve={false} />,
    )
    expect(container.querySelector('path')).toBeNull()
  })
})

describe('Histogram - bar hover tooltip', () => {
  const data = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]

  // getByTitle only special-cases an <svg> element itself having a <title>
  // child (per Testing Library's own docs) - it doesn't reach into an
  // arbitrary descendant like our capture <rect>, so it's found by walking
  // up from the <title> text node instead.
  function findCaptureArea(container: HTMLElement): Element {
    return container.querySelector('title')!.parentElement!
  }

  it('shows nothing until the plot area is hovered', () => {
    render(<Histogram data={data} theme={themes.tufte} />)
    expect(screen.queryByText(/value/)).toBeNull()
  })

  it('shows a range + count tooltip on hover and hides it again on mouse leave', () => {
    const { container } = render(<Histogram data={data} theme={themes.tufte} />)
    const captureArea = findCaptureArea(container)

    fireEvent.mouseMove(captureArea, { clientX: 20, clientY: 20 })
    expect(screen.getByText(/values?/)).toBeTruthy()

    fireEvent.mouseLeave(captureArea)
    expect(screen.queryByText(/values?/)).toBeNull()
  })

  it('shows both series counts for the hovered bin when comparing', () => {
    const compareData = [1, 2, 2, 3, 3, 3, 4, 4, 5, 5]
    const { container } = render(
      <Histogram
        data={data} compareData={compareData} label="Now" compareLabel="Before"
        theme={themes.tufte}
      />,
    )
    const captureArea = findCaptureArea(container)
    fireEvent.mouseMove(captureArea, { clientX: 20, clientY: 20 })

    expect(screen.getByText(/Now:/)).toBeTruthy()
    expect(screen.getByText(/Before:/)).toBeTruthy()
  })

  it('does not show a tooltip while a drag-to-zoom selection is in progress', () => {
    const { container } = render(<Histogram data={data} theme={themes.tufte} />)
    const captureArea = findCaptureArea(container)

    fireEvent.mouseDown(captureArea, { clientX: 20, clientY: 20 })
    fireEvent.mouseMove(captureArea, { clientX: 40, clientY: 20 })
    expect(screen.queryByText(/values?/)).toBeNull()
  })
})
