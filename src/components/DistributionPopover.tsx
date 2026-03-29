import { useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { descriptiveStats } from '../stats/descriptive'
import { matchDistributions } from '../stats/distribution-match'
import { Histogram } from './Histogram'
import { StatsSummary } from './StatsSummary'
import { DistributionMatchCard } from './DistributionMatchCard'
import type { BoxPlotTheme } from '../themes'

interface DistributionPopoverProps {
  data: number[]
  anchorRef: React.RefObject<SVGSVGElement | null>
  onClose: () => void
  theme: BoxPlotTheme
}

const POPOVER_WIDTH = 460

export function DistributionPopover({ data, anchorRef, onClose, theme }: DistributionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const t = theme.popover

  const stats = useMemo(() => descriptiveStats(data), [data])
  const matches = useMemo(() => matchDistributions(data), [data])

  const getPosition = useCallback(() => {
    if (!anchorRef.current) return { top: 0, left: 0 }
    const rect = anchorRef.current.getBoundingClientRect()
    const top = rect.bottom + 8
    let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2
    if (left < 8) left = 8
    if (left + POPOVER_WIDTH > window.innerWidth - 8) left = window.innerWidth - POPOVER_WIDTH - 8
    return { top, left }
  }, [anchorRef])

  const pos = getPosition()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const ruleStyle: React.CSSProperties = {
    border: 'none',
    borderTop: `1px solid ${t.rule}`,
    margin: '12px 0',
  }

  return createPortal(
    <>
      <div
        style={{
          position: 'fixed', inset: 0,
          background: t.backdropColor,
          backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          zIndex: 9998,
          animation: 'backdrop-in 0.15s ease-out',
        }}
        onClick={onClose}
      />
      <div
        ref={popoverRef}
        style={{
          position: 'fixed', top: pos.top, left: pos.left, width: POPOVER_WIDTH,
          background: t.bg,
          border: `1.5px solid ${t.border}`,
          borderRadius: 6,
          padding: '20px 16px 16px',
          zIndex: 9999,
          fontFamily: theme.font.family,
          boxShadow: t.shadow,
          animation: 'popover-in 0.15s ease-out',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 8, right: 8,
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none',
            border: `1px solid ${t.rule}`,
            borderRadius: 4, cursor: 'pointer',
            color: t.textMuted, fontSize: 14, fontFamily: theme.font.family,
            lineHeight: 1, padding: 0,
          }}
          aria-label="Close"
        >
          &times;
        </button>

        <Histogram data={data} width={POPOVER_WIDTH - 32} height={220} theme={theme} />
        <hr style={ruleStyle} />
        <StatsSummary stats={stats} theme={theme} />
        <hr style={ruleStyle} />
        <DistributionMatchCard matches={matches} theme={theme} />
      </div>
    </>,
    document.body,
  )
}
