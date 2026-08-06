import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DistributionPopover } from './DistributionPopover'
import { themes } from '../themes'

afterEach(cleanup)

// anchorRef.current is null throughout - DistributionPopover's own
// getPosition() explicitly guards for that (no real anchor to measure in
// jsdom) and falls back to a fixed {top:0, left:0}.
const anchorRef = { current: null }
const noop = () => {}
const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

describe('DistributionPopover - description', () => {
  it('renders description text under the title when provided', () => {
    render(
      <DistributionPopover
        data={data} anchorRef={anchorRef} onClose={noop} theme={themes.tufte}
        title="Latency" description="Round-trip time in milliseconds."
      />,
    )
    expect(screen.getByText('Round-trip time in milliseconds.')).toBeTruthy()
  })

  it('renders fine with no description at all', () => {
    render(<DistributionPopover data={data} anchorRef={anchorRef} onClose={noop} theme={themes.tufte} />)
    expect(screen.getByText('n')).toBeTruthy() // stats grid still renders
  })
})

describe('DistributionPopover - showDistributionMatch', () => {
  it('shows the best-match card by default', () => {
    render(<DistributionPopover data={data} anchorRef={anchorRef} onClose={noop} theme={themes.tufte} />)
    expect(screen.getByText('Best match')).toBeTruthy()
  })

  it('hides the best-match card when showDistributionMatch is false', () => {
    render(
      <DistributionPopover
        data={data} anchorRef={anchorRef} onClose={noop} theme={themes.tufte}
        showDistributionMatch={false}
      />,
    )
    expect(screen.queryByText('Best match')).toBeNull()
    // The rest of the popover (stats grid) is untouched by the toggle.
    expect(screen.getByText('n')).toBeTruthy()
  })

  it('hides the Shape section in comparison mode when showDistributionMatch is false', () => {
    const compareData = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    render(
      <DistributionPopover
        data={data} compareData={compareData}
        anchorRef={anchorRef} onClose={noop} theme={themes.tufte}
        showDistributionMatch={false}
      />,
    )
    expect(screen.queryByText('Shape')).toBeNull()
    // The delta table itself is a plain-stats section, not "best fit" info -
    // it stays regardless of the toggle.
    expect(screen.getByText('mean')).toBeTruthy()
  })

  it('shows the Shape section in comparison mode by default', () => {
    const compareData = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    render(
      <DistributionPopover
        data={data} compareData={compareData}
        anchorRef={anchorRef} onClose={noop} theme={themes.tufte}
      />,
    )
    expect(screen.getByText('Shape')).toBeTruthy()
  })
})
