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
