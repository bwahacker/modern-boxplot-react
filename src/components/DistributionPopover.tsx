import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { descriptiveStats } from '../stats/descriptive'
import { matchDistributions } from '../stats/distribution-match'
import { Histogram } from './Histogram'
import { StatsSummary } from './StatsSummary'
import { DistributionMatchCard } from './DistributionMatchCard'
import { CategoricalBarChart } from './CategoricalBarChart'
import { CategoricalStatsSummary } from './CategoricalStatsSummary'
import { CategoricalMatchCard } from './CategoricalMatchCard'
import type { CategoricalSummary } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface DistributionPopoverProps {
  data?: number[]
  categoricalSummary?: CategoricalSummary
  anchorRef: React.RefObject<SVGSVGElement | null>
  onClose: () => void
  theme: BoxPlotTheme
  /** Title displayed at the top of the popover card. */
  title?: string
  /** Footnote displayed at the bottom of the popover card. */
  footnote?: string
}

const POPOVER_WIDTH = 460

export function DistributionPopover({ data, categoricalSummary: catSummary, anchorRef, onClose, theme, title, footnote }: DistributionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const t = theme.popover
  const isCategorical = !!catSummary

  const stats = useMemo(() => data ? descriptiveStats(data) : null, [data])
  const matches = useMemo(() => data ? matchDistributions(data) : [], [data])

  const [measured, setMeasured] = useState(false)

  const getPosition = useCallback(() => {
    if (!anchorRef.current) return { top: 0, left: 0, maxHeight: undefined as number | undefined }
    const rect = anchorRef.current.getBoundingClientRect()
    const gap = 8
    const margin = 8

    // Horizontal clamping
    let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2
    if (left < margin) left = margin
    if (left + POPOVER_WIDTH > window.innerWidth - margin) left = window.innerWidth - POPOVER_WIDTH - margin

    // Vertical: measure popover if available, otherwise estimate
    const popoverH = popoverRef.current?.offsetHeight ?? 500
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap

    let top: number
    let maxHeight: number | undefined

    if (spaceBelow >= popoverH) {
      // Fits below
      top = rect.bottom + gap
    } else if (spaceAbove >= popoverH) {
      // Fits above
      top = rect.top - gap - popoverH
    } else if (spaceBelow >= spaceAbove) {
      // More room below — pin below with scroll
      top = rect.bottom + gap
      maxHeight = spaceBelow - margin
    } else {
      // More room above — pin above with scroll
      top = margin
      maxHeight = rect.top - gap - margin
    }

    return { top, left, maxHeight }
  }, [anchorRef])

  const pos = getPosition()

  // Re-measure after first render to get actual popover height
  useEffect(() => {
    if (!measured && popoverRef.current) {
      setMeasured(true)
    }
  }, [measured])

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
          ...(pos.maxHeight ? { maxHeight: pos.maxHeight, overflowY: 'auto' as const } : {}),
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

        {title && (
          <div style={{
            fontSize: 14, fontWeight: 600, color: t.text,
            marginBottom: 12, paddingRight: 20,
          }}>
            {title}
          </div>
        )}

        {isCategorical && catSummary ? (
          <>
            <CategoricalBarChart summary={catSummary} width={POPOVER_WIDTH - 32} height={220} theme={theme} />
            <hr style={ruleStyle} />
            <CategoricalStatsSummary summary={catSummary} theme={theme} />
            <hr style={ruleStyle} />
            <CategoricalMatchCard summary={catSummary} theme={theme} />
          </>
        ) : data && stats ? (
          <>
            <Histogram data={data} width={POPOVER_WIDTH - 32} height={220} theme={theme} />
            <hr style={ruleStyle} />
            <StatsSummary stats={stats} theme={theme} />
            <hr style={ruleStyle} />
            <DistributionMatchCard matches={matches} theme={theme} />
          </>
        ) : null}

        {footnote && (
          <>
            <hr style={ruleStyle} />
            <div style={{
              fontSize: 11, color: t.textMuted,
              lineHeight: 1.4,
            }}>
              {footnote}
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  )
}
