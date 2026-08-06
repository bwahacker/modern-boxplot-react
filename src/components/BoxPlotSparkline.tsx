import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { fiveNumberSummary, outliers, whiskerBounds, cleanData, mean as calcMean, stddev as calcStddev, percentileRank } from '../stats/descriptive'
import { kernelDensity } from '../stats/histogram'
import { categoricalSummary, isValueCounts, mergedCategoryOrder } from '../stats/categorical'
import type { CategoricalSummary, ValueCounts } from '../stats/categorical'
import { DistributionPopover } from './DistributionPopover'
import { SparklineTooltip } from './SparklineTooltip'
import { fmtAxis } from '../format'
import { themes } from '../themes'
import type { BoxPlotTheme } from '../themes'

export type BoxPlotVariant =
  | 'tufte'
  | 'classic'
  | 'minimal'
  | 'lollipop'
  | 'gradient'
  | 'violin'

export type BoxPlotSize = 'sm' | 'md' | 'lg'

const SIZE_PRESETS: Record<BoxPlotSize, { width: number; height: number }> = {
  sm: { width: 80, height: 16 },
  md: { width: 120, height: 24 },
  lg: { width: 180, height: 32 },
}

// Module-level: only one sparkline tooltip can be visible at a time.
// When a sparkline becomes hovered, it forcibly closes any other that was
// left open (e.g. because the browser dropped a mouseleave event during
// fast cursor movement across a dense grid).
let activeTooltipClose: (() => void) | null = null

export interface BoxPlotSparklineProps {
  /** Numeric array, string array, or value_counts dict (Record<string, number>) */
  data: number[] | string[] | ValueCounts
  width?: number
  height?: number
  variant?: BoxPlotVariant
  size?: BoxPlotSize
  theme?: BoxPlotTheme
  /** Explicit category ordering (e.g. Likert scales). Skips bell-curve optimization. */
  categoryOrder?: string[]
  /** Title displayed at the top of the popover card (e.g. column name). */
  title?: string
  /** Plain-language context shown under the title (e.g. "Checkout API response time, in milliseconds, last 7 days") - the single biggest lever for a viewer who has no idea what column they're looking at. */
  description?: string
  /** Footnote displayed at the bottom of the popover card. */
  footnote?: string
  /** True non-null count for the full column, when `data` is a truncated top-N value_counts dict (e.g. top 25). Displayed as N instead of the sum of the provided categories. */
  trueTotalCount?: number
  /** True distinct-value count for the full column, when `data` is a truncated top-N value_counts dict. */
  trueUniqueCount?: number
  /** A second snapshot of the same column to compare against `data` (e.g. last week's run, or a train/test split). Same shape as `data`. */
  compareData?: number[] | string[] | ValueCounts
  /** Label for the primary snapshot, shown only when `compareData` is present. Defaults to "Current". */
  label?: string
  /** Label for the comparison snapshot, shown only when `compareData` is present. Defaults to "Comparison". */
  compareLabel?: string
  /** trueTotalCount, but for `compareData`. */
  compareTrueTotalCount?: number
  /** trueUniqueCount, but for `compareData`. */
  compareTrueUniqueCount?: number
  /** Mark a specific value against the distribution (e.g. "this entity's value" in a report card), positioned using the component's actual internal scale rather than one a consumer has to replicate externally. Numeric data only - see `highlightCategory` for categorical. */
  highlightValue?: number
  /** Mark a specific category against the distribution. Categorical data only - see `highlightValue` for numeric. */
  highlightCategory?: string
  /** Override text shown for the highlight marker. Without it, and only for numeric `highlightValue`, a label is auto-generated from its percentile rank (framed by `direction` if given, e.g. "Better than 82% of peers"). Categorical highlights are unlabeled unless this is set explicitly. */
  highlightLabel?: string
  /** For numeric `highlightValue` with no explicit `highlightLabel`: which direction is "good," so the auto-generated label reads as "Better than X% of peers" instead of a bare, potentially misleading "Higher than X%". Omit when there's no meaningful direction. */
  direction?: 'higherIsBetter' | 'lowerIsBetter'
  /** Render lightweight min/median/max tick labels below the plot - something between the bare sparkline and the full popover, for when the sparkline is a report's sole visual anchor. Numeric data only; grows the rendered height by a fixed amount regardless of `size`/`width`/`height`. */
  showAxis?: boolean
  /** Overlay a fitted Gaussian curve on the categorical popover's bar chart. Off by default. */
  showFitCurve?: boolean
  /** Show the KDE density curve over the numeric popover's histogram. On by default; turn off for small/sparse samples where a smoothed curve implies more continuity than the data supports (the bars alone read more honestly). */
  showDensityCurve?: boolean
  /** Show the best-fit distribution card (and, in comparison mode, the shape-match verdict) on the numeric popover. On by default; turn off when a statistical "best fit" framing isn't meaningful for the data (e.g. tiny n, or data that isn't a scientific sample at all). */
  showDistributionMatch?: boolean
}

export function BoxPlotSparkline({
  data: rawData,
  width: widthOverride,
  height: heightOverride,
  variant = 'tufte',
  size = 'md',
  theme = themes.tufte,
  categoryOrder,
  title,
  description,
  footnote,
  trueTotalCount,
  trueUniqueCount,
  compareData,
  label,
  compareLabel,
  compareTrueTotalCount,
  compareTrueUniqueCount,
  highlightValue,
  highlightCategory,
  highlightLabel,
  direction,
  showAxis,
  showFitCurve,
  showDensityCurve,
  showDistributionMatch,
}: BoxPlotSparklineProps) {
  const ref = useRef<SVGSVGElement>(null)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const hoverTimer = useRef<number>()
  // Stable close handler registered in the module-level registry so other
  // sparklines can force-close this one when they become active.
  const closeRef = useRef<() => void>(() => {})
  closeRef.current = () => setHovered(false)

  const onMouseEnter = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => {
      // Force-close any other sparkline tooltip that's still showing.
      if (activeTooltipClose && activeTooltipClose !== closeRef.current) {
        activeTooltipClose()
      }
      activeTooltipClose = closeRef.current
      setHovered(true)
    }, 200)
  }, [])
  const onMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (activeTooltipClose === closeRef.current) activeTooltipClose = null
    setHovered(false)
  }, [])

  // Cleanup on unmount: clear pending timer and release registry slot.
  useEffect(() => {
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
      if (activeTooltipClose === closeRef.current) activeTooltipClose = null
    }
  }, [])

  // When the popover opens, hide the tooltip and release the registry slot.
  useEffect(() => {
    if (open) {
      if (hoverTimer.current) clearTimeout(hoverTimer.current)
      if (activeTooltipClose === closeRef.current) activeTooltipClose = null
      setHovered(false)
    }
  }, [open])

  const preset = SIZE_PRESETS[size]
  const width = widthOverride ?? preset.width
  const height = heightOverride ?? preset.height
  const c = theme.colors

  const isCategorical = isValueCounts(rawData) ||
    (Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === 'string')

  // A merged category order (shared with the compare snapshot, when present)
  // so bars/rows line up and categories exclusive to one side still get a
  // (zero-count) slot on the other instead of being silently dropped. This is
  // cheap (count-map sized, not row-sized) so it's safe to compute eagerly.
  const mergedOrder = useMemo(() => {
    if (!isCategorical || compareData === undefined) return categoryOrder
    return mergedCategoryOrder(
      rawData as string[] | ValueCounts,
      compareData as string[] | ValueCounts,
      categoryOrder,
    )
  }, [isCategorical, rawData, compareData, categoryOrder])

  const catSummary: CategoricalSummary | null = useMemo(() => {
    if (!isCategorical) return null
    const trueCounts = { totalCount: trueTotalCount, uniqueCount: trueUniqueCount }
    if (isValueCounts(rawData)) return categoricalSummary(rawData, mergedOrder, trueCounts)
    return categoricalSummary(rawData as string[], mergedOrder, trueCounts)
  }, [rawData, mergedOrder, isCategorical, trueTotalCount, trueUniqueCount])

  const data = useMemo(() => {
    if (isCategorical) return []
    return cleanData(rawData as number[])
  }, [rawData, isCategorical])

  // The compare-side numeric array is cheap to clean eagerly (same cost class
  // as the primary `data` above); the expensive descriptiveStats()/
  // matchDistributions() work on it stays lazy, inside the popover.
  const compareNumericData = useMemo(() => {
    if (isCategorical || compareData === undefined) return undefined
    return cleanData(compareData as number[])
  }, [isCategorical, compareData])

  const stats = useMemo(() => {
    if (data.length === 0) return null
    const fns = fiveNumberSummary(data)
    const wb = whiskerBounds(data)
    const outs = outliers(data)
    return { ...fns, whiskerLower: wb.lower, whiskerUpper: wb.upper, outliers: outs }
  }, [data])

  // Resolved once here (the single source of truth) and threaded down as a
  // plain string - Histogram/CategoricalBarChart never see `direction` or
  // call percentileRank themselves, matching how label/compareLabel already
  // flow through unchanged from this level down.
  const resolvedHighlightLabel = useMemo(() => {
    if (highlightLabel) return highlightLabel
    if (isCategorical) return undefined // no auto-computed label for categorical highlights
    if (highlightValue === undefined || data.length === 0) return undefined
    const raw = percentileRank(data, highlightValue)
    if (!Number.isFinite(raw)) return undefined
    if (direction) {
      const goodness = direction === 'lowerIsBetter' ? 100 - raw : raw
      return `Better than ${Math.round(goodness)}% of peers`
    }
    return `Higher than ${Math.round(raw)}% of peers`
  }, [highlightLabel, isCategorical, highlightValue, direction, data])

  const tooltipData = useMemo(() => {
    if (!stats || data.length === 0) return null
    return {
      n: data.length,
      min: stats.min,
      q1: stats.q1,
      median: stats.median,
      q3: stats.q3,
      max: stats.max,
      mean: calcMean(data),
      stddev: calcStddev(data),
      iqr: stats.q3 - stats.q1,
      outlierCount: stats.outliers.length,
    }
  }, [data, stats])

  const pad = 6
  const plotWidth = width - pad * 2
  const cy = height / 2
  const highlightColor = c.highlight ?? c.mean
  // showAxis is numeric-only (a categorical "axis" is really the category
  // labels CategoricalBarChart already renders); grows the SVG's own height
  // by a fixed strip, leaving `height`/`cy` - and every variant's proportions
  // that derive from them - untouched.
  const axisHeight = 12
  const svgHeight = !isCategorical && showAxis ? height + axisHeight : height

  // At the narrowest sizes (e.g. size="sm", 80px wide) three fixed-position
  // ticks can run into each other - the median tick is dropped first (min/max
  // are the more essential scale reference, and the highlight marker's own
  // position already gives a sense of where it falls between them).
  const axisTickText = stats ? { min: fmtAxis(stats.min), median: fmtAxis(stats.median), max: fmtAxis(stats.max) } : null
  const showMedianTick = !!axisTickText &&
    (axisTickText.min.length + axisTickText.median.length + axisTickText.max.length) * (theme.font.labelSize * 0.62) + 12 < plotWidth

  // ── Categorical rendering ───────────────────────────────────────────
  if (isCategorical && catSummary) {
    const cats = catSummary.categories
    const maxCount = Math.max(...cats.map(ct => ct.count))
    const barW = plotWidth / cats.length
    const gap = Math.max(0.5, barW * 0.1)
    const maxBarH = height * 0.9
    const highlightIndex = highlightCategory !== undefined
      ? cats.findIndex(ct => ct.label === highlightCategory)
      : -1

    const catPopover = open && (
      <DistributionPopover
        categoricalSummary={catSummary}
        compareCategoricalData={compareData as string[] | ValueCounts | undefined}
        compareCategoryOrder={mergedOrder}
        compareTrueCounts={{ totalCount: compareTrueTotalCount, uniqueCount: compareTrueUniqueCount }}
        anchorRef={ref}
        onClose={() => setOpen(false)}
        theme={theme}
        title={title}
        description={description}
        footnote={footnote}
        highlightCategory={highlightCategory}
        highlightLabel={resolvedHighlightLabel}
        showFitCurve={showFitCurve}
        label={label}
        compareLabel={compareLabel}
      />
    )

    const catTooltip = hovered && !open && (
      <SparklineTooltip anchorRef={ref} theme={theme} categoricalData={catSummary} />
    )

    if (cats.length === 0) {
      return (
        <svg width={width} height={height} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <text x={width / 2} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
            fill={c.secondary} fontSize={14} fontFamily={theme.font.family}>&mdash;</text>
        </svg>
      )
    }

    return (
      <>
        <svg
          width={width}
          height={height}
          ref={ref}
          style={{ display: 'inline-block', verticalAlign: 'middle', cursor: 'pointer' }}
          onClick={() => setOpen(!open)}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {cats.map((cat, i) => {
            const bx = pad + i * barW + gap / 2
            const bw = Math.max(1, barW - gap)
            const bh = maxCount > 0 ? (cat.count / maxCount) * maxBarH : 0
            const by = height - bh
            const isMode = cat.label === catSummary.mode
            return (
              <rect
                key={i}
                x={bx}
                y={by}
                width={bw}
                height={bh}
                fill={isMode ? c.primary : c.faint}
                stroke={isMode ? c.primary : c.secondary}
                strokeWidth={0.5}
                rx={0.5}
              />
            )
          })}
          {/* Highlight marker - a small flag above the matching bar, kept
              separate from the isMode bold-bar styling above so a category
              that's simultaneously the mode and the highlight shows both cues. */}
          {highlightIndex >= 0 && (() => {
            const hcx = pad + highlightIndex * barW + barW / 2
            return <polygon points={`${hcx - 3},0 ${hcx + 3},0 ${hcx},5`} fill={highlightColor} />
          })()}
        </svg>
        {catPopover}
        {catTooltip}
      </>
    )
  }

  // ── Numeric rendering ───────────────────────────────────────────────
  const hasHighlight = highlightValue !== undefined
  const popover = open && (
    <DistributionPopover
      data={data}
      compareData={compareNumericData}
      anchorRef={ref}
      onClose={() => setOpen(false)}
      theme={theme}
      title={title}
      description={description}
      footnote={footnote}
      highlightValue={highlightValue}
      highlightLabel={resolvedHighlightLabel}
      label={label}
      compareLabel={compareLabel}
      showDensityCurve={showDensityCurve}
      showDistributionMatch={showDistributionMatch}
    />
  )

  const tooltip = hovered && !open && tooltipData && (
    <SparklineTooltip
      anchorRef={ref} theme={theme} numericData={tooltipData}
      highlightValue={highlightValue} highlightLabel={resolvedHighlightLabel}
    />
  )

  if (data.length === 0) {
    return (
      <svg width={width} height={svgHeight} style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <text x={width / 2} y={cy + 1} textAnchor="middle" dominantBaseline="middle"
          fill={c.secondary} fontSize={14} fontFamily={theme.font.family}>&mdash;</text>
      </svg>
    )
  }

  if (data.length === 1 || !stats) {
    return (
      <>
        <svg width={width} height={svgHeight} style={{ display: 'inline-block', verticalAlign: 'middle', cursor: 'pointer' }}
          onClick={() => setOpen(!open)} ref={ref}>
          <circle cx={width / 2} cy={cy} r={2.5} fill={c.primary} />
        </svg>
        {popover}
      </>
    )
  }

  if (data.length < 4) {
    const dMin = Math.min(...data)
    const dMax = Math.max(...data)
    const rng = dMax - dMin || 1
    const sx = (v: number) => pad + ((v - dMin) / rng) * plotWidth
    const clampSx = (v: number) => Math.max(pad, Math.min(pad + plotWidth, sx(v)))
    return (
      <>
        <svg width={width} height={svgHeight} style={{ display: 'inline-block', verticalAlign: 'middle', cursor: 'pointer' }}
          onClick={() => setOpen(!open)} ref={ref}>
          {data.map((v, i) => (
            <circle key={i} cx={sx(v)} cy={cy} r={2} fill={c.primary} />
          ))}
          {hasHighlight && (
            <polygon points={`${clampSx(highlightValue!) - 2.5},0 ${clampSx(highlightValue!) + 2.5},0 ${clampSx(highlightValue!)},5`} fill={highlightColor} />
          )}
          {showAxis && axisTickText && (
            <g fontSize={theme.font.labelSize} fontFamily={theme.font.family} fill={c.secondary}>
              <text x={pad} y={svgHeight - 2} textAnchor="start">{axisTickText.min}</text>
              {showMedianTick && <text x={width / 2} y={svgHeight - 2} textAnchor="middle">{axisTickText.median}</text>}
              <text x={pad + plotWidth} y={svgHeight - 2} textAnchor="end">{axisTickText.max}</text>
            </g>
          )}
        </svg>
        {popover}
      </>
    )
  }

  const dataMin = Math.min(stats.whiskerLower, ...stats.outliers)
  const dataMax = Math.max(stats.whiskerUpper, ...stats.outliers)
  const range = dataMax - dataMin || 1
  const x = (v: number) => pad + ((v - dataMin) / range) * plotWidth
  const clampX = (v: number) => Math.max(pad, Math.min(pad + plotWidth, x(v)))

  const xWL = x(stats.whiskerLower)
  const xQ1 = x(stats.q1)
  const xMed = x(stats.median)
  const xQ3 = x(stats.q3)
  const xWR = x(stats.whiskerUpper)

  let content: React.ReactNode

  if (variant === 'tufte') {
    const gapR = Math.max(2, height * 0.1)
    content = (
      <>
        <line x1={xWL} y1={cy} x2={xQ1} y2={cy} stroke={c.secondary} strokeWidth={1} strokeLinecap="round" />
        <line x1={xQ1} y1={cy} x2={Math.max(xQ1, xMed - gapR)} y2={cy} stroke={c.primary} strokeWidth={height * 0.12} strokeLinecap="round" />
        <line x1={Math.min(xQ3, xMed + gapR)} y1={cy} x2={xQ3} y2={cy} stroke={c.primary} strokeWidth={height * 0.12} strokeLinecap="round" />
        <circle cx={xMed} cy={cy} r={gapR} fill={theme.popover.bg} stroke={c.primary} strokeWidth={1} />
        <line x1={xQ3} y1={cy} x2={xWR} y2={cy} stroke={c.secondary} strokeWidth={1} strokeLinecap="round" />
      </>
    )
  } else if (variant === 'classic') {
    const boxH = height * 0.55
    const capH = height * 0.35
    content = (
      <>
        <line x1={xWL} y1={cy} x2={xQ1} y2={cy} stroke={c.accent} strokeWidth={1} />
        <line x1={xQ3} y1={cy} x2={xWR} y2={cy} stroke={c.accent} strokeWidth={1} />
        <line x1={xWL} y1={cy - capH / 2} x2={xWL} y2={cy + capH / 2} stroke={c.accent} strokeWidth={1} />
        <line x1={xWR} y1={cy - capH / 2} x2={xWR} y2={cy + capH / 2} stroke={c.accent} strokeWidth={1} />
        <rect x={xQ1} y={cy - boxH / 2} width={xQ3 - xQ1} height={boxH} fill={c.faint} stroke={c.accent} strokeWidth={1} rx={1} />
        <line x1={xMed} y1={cy - boxH / 2} x2={xMed} y2={cy + boxH / 2} stroke={c.primary} strokeWidth={1.5} />
      </>
    )
  } else if (variant === 'minimal') {
    const tickH = height * 0.5
    const medTickH = height * 0.7
    content = (
      <>
        <line x1={xWL} y1={cy} x2={xWR} y2={cy} stroke={c.light} strokeWidth={0.75} />
        <line x1={xQ1} y1={cy - tickH / 2} x2={xQ1} y2={cy + tickH / 2} stroke={c.secondary} strokeWidth={1.5} strokeLinecap="round" />
        <line x1={xMed} y1={cy - medTickH / 2} x2={xMed} y2={cy + medTickH / 2} stroke={c.primary} strokeWidth={2} strokeLinecap="round" />
        <line x1={xQ3} y1={cy - tickH / 2} x2={xQ3} y2={cy + tickH / 2} stroke={c.secondary} strokeWidth={1.5} strokeLinecap="round" />
      </>
    )
  } else if (variant === 'lollipop') {
    const dotR = Math.max(1.5, height * 0.07)
    const medR = dotR * 1.6
    content = (
      <>
        <line x1={xWL} y1={cy} x2={xWR} y2={cy} stroke={c.light} strokeWidth={1} strokeLinecap="round" />
        <circle cx={xWL} cy={cy} r={dotR} fill={c.secondary} />
        <circle cx={xQ1} cy={cy} r={dotR} fill={c.accent} />
        <circle cx={xMed} cy={cy} r={medR} fill={c.primary} />
        <circle cx={xQ3} cy={cy} r={dotR} fill={c.accent} />
        <circle cx={xWR} cy={cy} r={dotR} fill={c.secondary} />
      </>
    )
  } else if (variant === 'gradient') {
    const barH = height * 0.4
    const gradId = `grad-${Math.random().toString(36).slice(2, 8)}`
    const wlPct = ((xWL - pad) / plotWidth) * 100
    const q1Pct = ((xQ1 - pad) / plotWidth) * 100
    const medPct = ((xMed - pad) / plotWidth) * 100
    const q3Pct = ((xQ3 - pad) / plotWidth) * 100
    const wrPct = ((xWR - pad) / plotWidth) * 100
    content = (
      <>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset={`${wlPct}%`} stopColor={c.primary} stopOpacity={0.05} />
            <stop offset={`${q1Pct}%`} stopColor={c.primary} stopOpacity={0.3} />
            <stop offset={`${medPct}%`} stopColor={c.primary} stopOpacity={0.7} />
            <stop offset={`${q3Pct}%`} stopColor={c.primary} stopOpacity={0.3} />
            <stop offset={`${wrPct}%`} stopColor={c.primary} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <rect x={pad} y={cy - barH / 2} width={plotWidth} height={barH} fill={`url(#${gradId})`} rx={barH / 2} />
        <line x1={xMed} y1={cy - barH / 2 - 2} x2={xMed} y2={cy + barH / 2 + 2} stroke={c.primary} strokeWidth={1.5} strokeLinecap="round" />
      </>
    )
  } else {
    const kde = kernelDensity(data, 40)
    if (kde.length < 2) return null
    const maxY = Math.max(...kde.map(p => p.y))
    const halfH = height * 0.42
    const kdeXMin = kde[0].x
    const kdeXMax = kde[kde.length - 1].x
    const kdeRange = kdeXMax - kdeXMin || 1
    const kx = (v: number) => pad + ((v - kdeXMin) / kdeRange) * plotWidth
    const ky = (density: number) => (density / maxY) * halfH
    let topPath = ''
    let bottomPath = ''
    for (let i = 0; i < kde.length; i++) {
      const px = kx(kde[i].x)
      const spread = ky(kde[i].y)
      topPath += `${i === 0 ? 'M' : 'L'}${px},${cy - spread}`
      bottomPath = `L${px},${cy + spread}` + bottomPath
    }
    const violinPath = topPath + bottomPath + 'Z'
    content = (
      <>
        <path d={violinPath} fill={c.faint} stroke={c.secondary} strokeWidth={0.75} />
        <line x1={xMed} y1={cy - halfH * 0.3} x2={xMed} y2={cy + halfH * 0.3} stroke={c.primary} strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={xQ1} cy={cy} r={1.5} fill={c.accent} />
        <circle cx={xQ3} cy={cy} r={1.5} fill={c.accent} />
      </>
    )
  }

  return (
    <>
      <svg
        width={width}
        height={svgHeight}
        ref={ref}
        style={{ display: 'inline-block', verticalAlign: 'middle', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {content}
        {stats.outliers.map((v, i) => (
          <circle key={i} cx={x(v)} cy={cy} r={1.5} fill={c.secondary} opacity={0.6} />
        ))}
        {hasHighlight && (
          <polygon points={`${clampX(highlightValue!) - 2.5},0 ${clampX(highlightValue!) + 2.5},0 ${clampX(highlightValue!)},5`} fill={highlightColor} />
        )}
        {showAxis && axisTickText && (
          <g fontSize={theme.font.labelSize} fontFamily={theme.font.family} fill={c.secondary}>
            <text x={pad} y={svgHeight - 2} textAnchor="start">{axisTickText.min}</text>
            {showMedianTick && <text x={width / 2} y={svgHeight - 2} textAnchor="middle">{axisTickText.median}</text>}
            <text x={pad + plotWidth} y={svgHeight - 2} textAnchor="end">{axisTickText.max}</text>
          </g>
        )}
      </svg>
      {popover}
      {tooltip}
    </>
  )
}
