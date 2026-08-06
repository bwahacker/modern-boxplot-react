import { useEffect, useLayoutEffect, useRef, useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { descriptiveStats } from '../stats/descriptive'
import { matchDistributions } from '../stats/distribution-match'
import { categoricalSummary } from '../stats/categorical'
import { Histogram } from './Histogram'
import { StatsSummary } from './StatsSummary'
import { DistributionMatchCard } from './DistributionMatchCard'
import { DistributionDiffSummary } from './DistributionDiffSummary'
import { CategoricalBarChart } from './CategoricalBarChart'
import { CategoricalStatsSummary } from './CategoricalStatsSummary'
import { CategoricalMatchCard } from './CategoricalMatchCard'
import { CategoricalDiffSummary } from './CategoricalDiffSummary'
import type { CategoricalSummary, TrueCounts, ValueCounts } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface DistributionPopoverProps {
  data?: number[]
  categoricalSummary?: CategoricalSummary
  anchorRef: React.RefObject<SVGSVGElement | null>
  onClose: () => void
  theme: BoxPlotTheme
  /** Title displayed at the top of the popover card. */
  title?: string
  /** Plain-language context shown under the title. */
  description?: string
  /** Footnote displayed at the bottom of the popover card. */
  footnote?: string
  /** A second numeric snapshot to compare against `data`. */
  compareData?: number[]
  /** A second categorical snapshot (raw, not yet summarized) to compare against `categoricalSummary`. */
  compareCategoricalData?: string[] | ValueCounts
  /** Shared category order (see `mergedCategoryOrder`) used to compute the compare-side summary so bars/rows line up with the primary side. */
  compareCategoryOrder?: string[]
  compareTrueCounts?: TrueCounts
  /** Label for the primary snapshot, shown only when comparing. Defaults to "Current". */
  label?: string
  /** Label for the comparison snapshot, shown only when comparing. Defaults to "Comparison". */
  compareLabel?: string
  /** Numeric highlight value, passed straight through to Histogram. */
  highlightValue?: number
  /** Categorical highlight, passed straight through to CategoricalBarChart. */
  highlightCategory?: string
  /** Pre-resolved highlight label text (percentile framing already applied upstream in BoxPlotSparkline). */
  highlightLabel?: string
  /** Overlay a fitted Gaussian curve on the categorical bar chart. Off by default. */
  showFitCurve?: boolean
  /** Show the KDE density curve on the numeric histogram. Defaults to true. */
  showDensityCurve?: boolean
  /** Show the best-fit distribution card / shape-match verdict. Defaults to true. */
  showDistributionMatch?: boolean
}

const POPOVER_WIDTH = 460
const FULLSCREEN_MARGIN = 24
const FULLSCREEN_MAX_WIDTH = 1100
const DEFAULT_LABEL = 'Current'
const DEFAULT_COMPARE_LABEL = 'Comparison'

export function DistributionPopover({
  data, categoricalSummary: catSummary, anchorRef, onClose, theme, title, description, footnote,
  compareData, compareCategoricalData, compareCategoryOrder, compareTrueCounts,
  label = DEFAULT_LABEL, compareLabel = DEFAULT_COMPARE_LABEL,
  highlightValue, highlightCategory, highlightLabel, showFitCurve,
  showDensityCurve = true, showDistributionMatch = true,
}: DistributionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const t = theme.popover
  const isCategorical = !!catSummary

  const stats = useMemo(() => data ? descriptiveStats(data) : null, [data])
  const matches = useMemo(() => data ? matchDistributions(data) : [], [data])

  // Compare-side computation is entirely lazy - it only runs once the
  // popover is actually open, mirroring how the primary side's stats/matches
  // already work above.
  const compareStats = useMemo(() => compareData ? descriptiveStats(compareData) : null, [compareData])
  const compareMatches = useMemo(() => compareData ? matchDistributions(compareData) : [], [compareData])
  const compareCatSummary = useMemo(() => {
    if (!compareCategoricalData) return null
    return categoricalSummary(compareCategoricalData, compareCategoryOrder, compareTrueCounts)
  }, [compareCategoricalData, compareCategoryOrder, compareTrueCounts])

  const [measured, setMeasured] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [contentWidth, setContentWidth] = useState(POPOVER_WIDTH - 32)

  // Charts size themselves to the popover's actual content width, so they
  // grow when the fullscreen panel gives them more room.
  useEffect(() => {
    const el = popoverRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setContentWidth(w - 32)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const getPosition = useCallback(() => {
    if (!anchorRef.current) return { top: 0, left: 0, maxHeight: undefined as number | undefined }
    const rect = anchorRef.current.getBoundingClientRect()
    const gap = 8
    const margin = 8

    // Horizontal clamping
    let left = rect.left + rect.width / 2 - POPOVER_WIDTH / 2
    if (left < margin) left = margin
    if (left + POPOVER_WIDTH > window.innerWidth - margin) left = window.innerWidth - POPOVER_WIDTH - margin

    // Vertical: measure popover if available, otherwise estimate. Uses
    // scrollHeight (the true content height, ignoring any overflow clipping)
    // rather than offsetHeight (the current, possibly maxHeight-constrained
    // rendered height) - offsetHeight here would be self-referential: once a
    // maxHeight constrains the popover, offsetHeight reflects THAT constraint
    // rather than the actual content, so re-deriving maxHeight from it on the
    // next render flip-flops between "fits, no constraint" and "doesn't fit,
    // constrained" every time this recomputes (visible as the popover
    // flashing between two sizes right after opening, worse with more
    // content - e.g. many categorical bars pushing a long frequency table).
    const popoverH = popoverRef.current?.scrollHeight ?? 500
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

  // Re-measure after first render to get actual popover height. Uses
  // useLayoutEffect (not useEffect) so the correction happens synchronously
  // before the browser paints - a regular useEffect runs post-paint, which
  // means the browser would actually paint the wrong (unconstrained-height,
  // pre-measurement) layout for one frame before snapping to the corrected
  // one - a visible "flash," worse the taller the initial guess is off by
  // (e.g. a popover with many categorical bars and a long frequency table).
  useLayoutEffect(() => {
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
          position: 'fixed',
          background: t.bg,
          border: `1.5px solid ${t.border}`,
          borderRadius: 6,
          padding: '20px 16px 16px',
          zIndex: 9999,
          fontFamily: theme.font.family,
          boxShadow: t.shadow,
          animation: 'popover-in 0.15s ease-out',
          overflowY: 'auto',
          ...(fullscreen
            ? {
              // Only top/left/right are pinned - `bottom` is deliberately
              // left unset. Pinning all four (as `inset` would) forces
              // height:auto to solve as "fill exactly to the viewport
              // edge" per the CSS box model for absolutely-positioned
              // elements, regardless of actual content - which is what
              // produced a full-height panel with a large dead void below
              // short content. Leaving `bottom` unset lets height stay
              // intrinsic to content, capped by maxHeight (with the
              // overflowY:auto already set above) for the rare case
              // content is taller than the viewport.
              top: FULLSCREEN_MARGIN, left: FULLSCREEN_MARGIN, right: FULLSCREEN_MARGIN,
              width: 'auto', maxWidth: FULLSCREEN_MAX_WIDTH, margin: '0 auto',
              maxHeight: `calc(100vh - ${FULLSCREEN_MARGIN * 2}px)`,
            }
            : {
              top: pos.top, left: pos.left, width: POPOVER_WIDTH,
              ...(pos.maxHeight ? { maxHeight: pos.maxHeight } : {}),
            }),
        }}
      >
        <button
          onClick={() => setFullscreen(v => !v)}
          style={{
            position: 'absolute', top: 8, right: 38,
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none',
            border: `1px solid ${t.rule}`,
            borderRadius: 4, cursor: 'pointer',
            color: t.textMuted, padding: 0,
          }}
          aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
          title={fullscreen ? 'Exit full screen' : 'Full screen'}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            {fullscreen ? (
              <>
                <path d="M4 1v3H1" />
                <path d="M8 1v3h3" />
                <path d="M11 8H8v3" />
                <path d="M1 8h3v3" />
              </>
            ) : (
              <>
                <path d="M1 4V1h3" />
                <path d="M8 1h3v3" />
                <path d="M11 8v3H8" />
                <path d="M4 11H1V8" />
              </>
            )}
          </svg>
        </button>

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

        {/* Always reserves a header row (even without a title) so the header
            buttons never end up overlapping - and stealing clicks from -
            full-width chart content that would otherwise start right underneath them. */}
        <div style={{
          fontSize: fullscreen ? 18 : 14, fontWeight: 600, color: t.text,
          minHeight: 24, marginBottom: title || description ? 4 : 8, paddingRight: 50,
        }}>
          {title}
        </div>

        {description && (
          <div style={{
            fontSize: fullscreen ? 14 : 12, color: t.textMuted, lineHeight: 1.4,
            marginBottom: 12,
          }}>
            {description}
          </div>
        )}

        {isCategorical && catSummary ? (
          <>
            <CategoricalBarChart
              summary={catSummary} compareSummary={compareCatSummary ?? undefined}
              width={contentWidth} height={fullscreen ? 480 : 220} theme={theme}
              label={label} compareLabel={compareLabel}
              highlightCategory={highlightCategory} highlightLabel={highlightLabel}
              showFitCurve={showFitCurve} fullscreen={fullscreen}
            />
            <hr style={ruleStyle} />
            <CategoricalStatsSummary
              summary={catSummary} compareSummary={compareCatSummary ?? undefined}
              theme={theme} label={label} compareLabel={compareLabel} fullscreen={fullscreen}
            />
            <hr style={ruleStyle} />
            {compareCatSummary ? (
              <CategoricalDiffSummary
                summary={catSummary} compareSummary={compareCatSummary}
                theme={theme} label={label} compareLabel={compareLabel} fullscreen={fullscreen}
              />
            ) : (
              <CategoricalMatchCard summary={catSummary} theme={theme} fullscreen={fullscreen} />
            )}
          </>
        ) : data && stats ? (
          <>
            <Histogram
              data={data} compareData={compareData} width={contentWidth} height={fullscreen ? 480 : 220} theme={theme}
              label={label} compareLabel={compareLabel}
              highlightValue={highlightValue} highlightLabel={highlightLabel}
              showDensityCurve={showDensityCurve} fullscreen={fullscreen}
            />
            <hr style={ruleStyle} />
            {compareStats ? (
              <DistributionDiffSummary
                stats={stats} compareStats={compareStats} matches={matches} compareMatches={compareMatches}
                theme={theme} label={label} compareLabel={compareLabel}
                showDistributionMatch={showDistributionMatch} fullscreen={fullscreen}
              />
            ) : (
              <>
                <StatsSummary stats={stats} theme={theme} fullscreen={fullscreen} />
                {showDistributionMatch && (
                  <>
                    <hr style={ruleStyle} />
                    <DistributionMatchCard matches={matches} theme={theme} fullscreen={fullscreen} />
                  </>
                )}
              </>
            )}
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
