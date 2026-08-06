import { useEffect, useMemo, useRef, useState } from 'react'
import { binData, kernelDensity } from '../stats/histogram'
import { fiveNumberSummary, mean as calcMean, whiskerBounds, outliers as calcOutliers } from '../stats/descriptive'
import { linearScale, symlogScale, defaultLinthresh, type AxisScale } from '../stats/scale'
import { fmtAxis } from '../format'
import type { BoxPlotTheme } from '../themes'

interface HistogramProps {
  data: number[]
  width?: number
  height?: number
  theme: BoxPlotTheme
  /** A second snapshot to compare against `data`, overlaid on the same axes. */
  compareData?: number[]
  /** Label for the primary snapshot, shown only when `compareData` is present. */
  label?: string
  /** Label for the comparison snapshot, shown only when `compareData` is present. */
  compareLabel?: string
  /** A specific value to mark against the distribution (e.g. "this entity's value"), independent of `compareData`. */
  highlightValue?: number
  /** Pre-resolved display text for the highlight marker (e.g. "Better than 82% of peers"). Rendered as-is - percentile computation and direction framing happen upstream in `BoxPlotSparkline`. */
  highlightLabel?: string
  /** Show the KDE density curve overlay. Defaults to true; turn off for small/sparse samples where a smoothed curve implies more continuity than the data supports. */
  showDensityCurve?: boolean
  /** Scales up chart typography and marker spacing for the popover's full-screen mode. */
  fullscreen?: boolean
}

interface HoverBin {
  x0: number
  x1: number
  count: number
  compareCount?: number
  clientX: number
  clientY: number
}

type ScaleMode = 'linear' | 'symlog'

/** Sturges' rule - duplicated from stats/histogram.ts (not exported there) since
 * it's needed here to bin two datasets into one shared set of edges. */
function sturgesBinCount(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(n) + 1))
}

function sharedBinEdges(min: number, max: number, n: number): { x0: number; x1: number }[] {
  if (min === max) return [{ x0: min - 0.5, x1: max + 0.5 }]
  const width = (max - min) / n
  return Array.from({ length: n }, (_, i) => ({ x0: min + i * width, x1: min + (i + 1) * width }))
}

/** Counts values into pre-defined bin edges (rather than deriving its own
 * edges from the data), so two datasets can be binned identically for a
 * meaningful side-by-side comparison. */
function countInBins(values: number[], edges: { x0: number; x1: number }[]): number[] {
  const n = edges.length
  if (n === 0) return []
  const min = edges[0].x0
  const width = edges[0].x1 - edges[0].x0
  const counts = new Array(n).fill(0)
  for (const v of values) {
    let idx = width === 0 ? 0 : Math.floor((v - min) / width)
    if (idx < 0) idx = 0
    if (idx >= n) idx = n - 1
    counts[idx]++
  }
  return counts
}

/** Evenly spaced "nice" ticks for a linear axis. */
function linearTicks(min: number, max: number): number[] {
  const range = max - min || 1
  const tickCount = 5
  const rawStep = range / (tickCount - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const niceSteps = [1, 2, 5, 10]
  const niceStep = niceSteps.find(s => s * magnitude >= rawStep)! * magnitude
  const firstTick = Math.ceil(min / niceStep) * niceStep
  const ticks: number[] = []
  for (let t = firstTick; t <= max; t += niceStep) ticks.push(t)
  return ticks
}

/** Ticks at "nice" magnitudes (1/2/5 x powers of ten, plus zero) - evenly
 * spaced linear ticks would bunch up or spread out oddly on a log-like axis. */
function symlogTicks(min: number, max: number): number[] {
  const maxAbs = Math.max(Math.abs(min), Math.abs(max))
  const candidates = new Set<number>([0])
  if (maxAbs > 0) {
    const topPow = Math.ceil(Math.log10(maxAbs))
    for (let p = topPow; p >= topPow - 4; p--) {
      for (const m of [1, 2, 5]) {
        const v = m * Math.pow(10, p)
        if (v <= maxAbs * 1.0001) {
          candidates.add(v)
          candidates.add(-v)
        }
      }
    }
  }
  return [...candidates].filter(v => v >= min && v <= max).sort((a, b) => a - b)
}

export function Histogram({
  data, width = 420, height = 232, theme,
  compareData, label = 'Current', compareLabel = 'Comparison',
  highlightValue, highlightLabel, showDensityCurve = true, fullscreen = false,
}: HistogramProps) {
  const isComparing = compareData !== undefined
  const hasHighlight = highlightValue !== undefined
  // Extra headroom for the highlight marker's flag + label, reserved as its
  // own strip above the plot. When also comparing, that strip is pushed down
  // by an extra legend-clearance amount so it lands below the compare legend
  // (an HTML overlay that sits at y:0, outside this SVG coordinate system,
  // and normally just floats over the plot's own top padding uncontested).
  const highlightLegendClearance = hasHighlight && isComparing ? 14 : 0
  const pad = { top: 12 + (hasHighlight ? 16 : 0) + highlightLegendClearance, right: 16, bottom: 64, left: 16 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const c = theme.colors
  const t = theme.popover
  const f = theme.font
  // In fullscreen, chart text/marker spacing scale up together so a bigger
  // chart doesn't just mean the same tiny labels with more empty space
  // around them - and the marker-collision math below (rowHeight/minGap/
  // edgeMargin) scales by the same factor so it stays proportionally valid.
  const fx = fullscreen ? 1.3 : 1
  // SVG chart text defaults to the theme's label size rather than small
  // hardcoded pixel values, so it scales with the rest of the UI.
  const tickFontSize = f.labelSize * fx
  const markerLabelFontSize = f.labelSize * fx
  const markerValueFontSize = (f.labelSize - 0.5) * fx
  const highlightColor = c.highlight ?? c.mean

  const svgRef = useRef<SVGSVGElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [scaleMode, setScaleMode] = useState<ScaleMode>('linear')
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragStartPx, setDragStartPx] = useState<number | null>(null)
  const [dragCurrentPx, setDragCurrentPx] = useState<number | null>(null)
  const [hoverBin, setHoverBin] = useState<HoverBin | null>(null)

  // Stats always reflect the full column, regardless of zoom.
  const fns = useMemo(() => fiveNumberSummary(data), [data])
  const dataMean = useMemo(() => calcMean(data), [data])
  const wb = useMemo(() => whiskerBounds(data), [data])
  const dataOutliers = useMemo(() => calcOutliers(data), [data])
  const trueMin = fns.min
  const trueMax = fns.max

  const compareFns = useMemo(() => compareData ? fiveNumberSummary(compareData) : null, [compareData])
  const compareMean = useMemo(() => compareData ? calcMean(compareData) : null, [compareData])
  const compareWb = useMemo(() => compareData ? whiskerBounds(compareData) : null, [compareData])
  const compareOutliers = useMemo(() => compareData ? calcOutliers(compareData) : [], [compareData])

  // Bins/KDE are recomputed from just the zoomed-in subset, so zooming both
  // narrows the axis and reveals finer bin resolution - not just a visual crop.
  const visibleData = useMemo(() => {
    if (!zoomDomain) return data
    const [lo, hi] = zoomDomain
    return data.filter(v => v >= lo && v <= hi)
  }, [data, zoomDomain])

  const visibleCompareData = useMemo(() => {
    if (!compareData) return undefined
    if (!zoomDomain) return compareData
    const [lo, hi] = zoomDomain
    return compareData.filter(v => v >= lo && v <= hi)
  }, [compareData, zoomDomain])

  // When comparing, both datasets are binned into one shared set of edges
  // (spanning their combined range) so the two sets of bars sit at identical
  // x positions - not two independently-Sturges-binned charts glued together.
  // When not comparing this is byte-identical to the original single-dataset call.
  const bins = useMemo(() => {
    if (!isComparing) return binData(visibleData)
    const combined = [...visibleData, ...(visibleCompareData ?? [])]
    if (combined.length === 0) return []
    const min = Math.min(...combined)
    const max = Math.max(...combined)
    const edges = sharedBinEdges(min, max, sturgesBinCount(visibleData.length))
    const counts = countInBins(visibleData, edges)
    return edges.map((e, i) => ({ ...e, count: counts[i] }))
  }, [visibleData, visibleCompareData, isComparing])

  const compareBins = useMemo(() => {
    if (!isComparing || !visibleCompareData || bins.length === 0) return []
    const counts = countInBins(visibleCompareData, bins)
    return bins.map((b, i) => ({ x0: b.x0, x1: b.x1, count: counts[i] }))
  }, [isComparing, visibleCompareData, bins])

  const kde = useMemo(() => kernelDensity(visibleData, 80), [visibleData])
  const compareKde = useMemo(() => visibleCompareData ? kernelDensity(visibleCompareData, 80) : [], [visibleCompareData])

  const maxCount = Math.max(...bins.map(b => b.count), ...compareBins.map(b => b.count), 1)
  const maxDensity = Math.max(...kde.map(p => p.y), ...compareKde.map(p => p.y), 1e-10)

  const linthresh = useMemo(() => defaultLinthresh(data, trueMax - trueMin), [data, trueMin, trueMax])
  const scale: AxisScale = scaleMode === 'symlog' ? symlogScale(linthresh) : linearScale

  // Close the options menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Drag-to-zoom: track the pointer on window once a drag starts so the
  // selection still updates even if the cursor leaves the plot area.
  useEffect(() => {
    if (dragStartPx === null) return
    const onMove = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (!rect) return
      setDragCurrentPx(e.clientX - rect.left)
    }
    const onUp = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect()
      if (rect) {
        const endPx = e.clientX - rect.left
        if (Math.abs(endPx - dragStartPx) > 5) {
          const loPx = Math.min(dragStartPx, endPx)
          const hiPx = Math.max(dragStartPx, endPx)
          const loVal = invertX(loPx)
          const hiVal = invertX(hiPx)
          const lo = Math.max(trueMin, Math.min(loVal, hiVal))
          const hi = Math.min(trueMax, Math.max(loVal, hiVal))
          if (hi > lo && data.some(v => v >= lo && v <= hi)) {
            setZoomDomain([lo, hi])
          }
        }
      }
      setDragStartPx(null)
      setDragCurrentPx(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragStartPx])

  // A stale hover tooltip referencing a bin from before a zoom/scale change
  // would show wrong numbers until the next mousemove - clear it proactively.
  useEffect(() => {
    setHoverBin(null)
  }, [zoomDomain, scaleMode])

  if (bins.length === 0) return null

  const xMin = bins[0].x0
  const xMax = bins[bins.length - 1].x1
  // Bins are always uniform-width (see binData/sharedBinEdges), so the
  // hovered bin index can be computed directly instead of scanned for.
  const binWidth = bins[0].x1 - bins[0].x0 || 1
  const scaledMin = scale.forward(xMin)
  const scaledMax = scale.forward(xMax)
  const scaledRange = scaledMax - scaledMin || 1

  const xScale = (v: number) => pad.left + ((scale.forward(v) - scaledMin) / scaledRange) * plotW
  const invertX = (px: number) => scale.invert(((px - pad.left) / plotW) * scaledRange + scaledMin)
  const yScaleKDE = (density: number) => plotH - (density / maxDensity) * plotH
  const clampX = (v: number) => Math.max(pad.left, Math.min(pad.left + plotW, xScale(v)))

  const kdePath = kde
    .map((p, i) => {
      const px = xScale(p.x)
      const py = pad.top + yScaleKDE(p.y)
      return `${i === 0 ? 'M' : 'L'}${px},${py}`
    })
    .join(' ')

  const compareKdePath = compareKde
    .map((p, i) => {
      const px = xScale(p.x)
      const py = pad.top + yScaleKDE(p.y)
      return `${i === 0 ? 'M' : 'L'}${px},${py}`
    })
    .join(' ')

  const baseline = pad.top + plotH

  // Individual min/Q1/median/mean/Q3/max markers are only shown for a single
  // dataset - with two datasets that's up to 12 labels fighting for space on
  // top of a mechanism that already staggers rows to avoid collisions for
  // *one* dataset. The dual box-plot strip below gives a visual comparison,
  // and DistributionDiffSummary gives exact numbers.
  const rawMarkers: { value: number; label: string; color: string; priority: number }[] = isComparing ? [] : [
    { value: fns.min, label: 'min', color: c.secondary, priority: 1 },
    { value: fns.q1, label: 'Q1', color: c.accent, priority: 2 },
    { value: fns.median, label: 'median', color: c.primary, priority: 4 },
    { value: dataMean, label: 'mean', color: c.mean, priority: 3 },
    { value: fns.q3, label: 'Q3', color: c.accent, priority: 2 },
    { value: fns.max, label: 'max', color: c.secondary, priority: 1 },
  ]

  // Markers that display the same rounded value (common for zero-inflated
  // or heavily-tied data, e.g. min = Q1 = median = 0.00) are combined into
  // one row instead of each claiming its own - showing "0.00" three times
  // on three separate rows says nothing three separate labels don't.
  const markersByDisplayValue = new Map<string, typeof rawMarkers>()
  for (const m of rawMarkers) {
    const key = fmtAxis(m.value)
    if (!markersByDisplayValue.has(key)) markersByDisplayValue.set(key, [])
    markersByDisplayValue.get(key)!.push(m)
  }
  const markers = [...markersByDisplayValue.values()].map(group => {
    if (group.length === 1) return group[0]
    const best = group.reduce((a, b) => (a.priority >= b.priority ? a : b))
    return {
      value: best.value,
      label: group.map(g => g.label).join('/'),
      color: best.color,
      priority: Math.max(...group.map(g => g.priority)),
    }
  })

  // Markers whose labels would collide are staggered onto extra rows below
  // the axis instead of being dropped - every marker stays visible.
  const sortedMarkers = [...markers].sort((a, b) => b.priority - a.priority)
  const rowHeight = 22 * fx
  const minGap = 34 * fx
  const rowsX: number[][] = []
  const placedMarkers = sortedMarkers.map(m => {
    const mx = clampX(m.value)
    let row = 0
    while (rowsX[row] && rowsX[row].some(px => Math.abs(px - mx) < minGap)) row++
    if (!rowsX[row]) rowsX[row] = []
    rowsX[row].push(mx)
    return { ...m, x: mx, row }
  })
  placedMarkers.sort((a, b) => a.value - b.value)
  const maxRow = Math.max(0, rowsX.length - 1)

  const ticks = scaleMode === 'symlog' ? symlogTicks(xMin, xMax) : linearTicks(xMin, xMax)

  const svgHeight = height + maxRow * rowHeight
  const isZoomed = zoomDomain !== null
  const canZoomToIQR = fns.q1 < fns.q3
  const menuActive = isZoomed || scaleMode === 'symlog'

  const menuItemStyle = (disabled?: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '5px 10px',
    fontSize: f.labelSize,
    fontFamily: f.family,
    background: 'none',
    border: 'none',
    borderRadius: 3,
    color: disabled ? t.rule : t.text,
    cursor: disabled ? 'default' : 'pointer',
  })

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Chart options"
        title="Chart options"
        style={{
          position: 'absolute', top: 0, right: 0,
          width: 20, height: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, zIndex: 1,
        }}
      >
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            display: 'block', width: 13, height: 1.5, borderRadius: 1,
            background: menuActive ? c.primary : t.textMuted,
          }} />
        ))}
      </button>

      {isComparing && (
        <div style={{
          position: 'absolute', top: 0, left: pad.left,
          display: 'flex', gap: 10, fontSize: tickFontSize, fontFamily: f.family,
          pointerEvents: 'none',
        }}>
          <span style={{ color: c.primary }}>― {label}</span>
          <span style={{ color: c.mean }}>┄ {compareLabel}</span>
        </div>
      )}

      {menuOpen && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute', top: 24, right: 0, minWidth: 140,
            background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6,
            boxShadow: t.shadow, padding: 4, zIndex: 2,
          }}
        >
          <div style={{ padding: '4px 10px 2px', fontSize: f.labelSize - 1, letterSpacing: '0.05em', textTransform: 'uppercase', color: t.textMuted }}>
            Scale
          </div>
          <button style={menuItemStyle()} onClick={() => { setScaleMode('linear'); setMenuOpen(false) }}>
            {scaleMode === 'linear' ? '✓ ' : '  '}Linear
          </button>
          <button style={menuItemStyle()} onClick={() => { setScaleMode('symlog'); setMenuOpen(false) }}>
            {scaleMode === 'symlog' ? '✓ ' : '  '}Log
          </button>
          <hr style={{ border: 'none', borderTop: `1px solid ${t.rule}`, margin: '4px 0' }} />
          <button
            style={menuItemStyle(!canZoomToIQR)}
            disabled={!canZoomToIQR}
            onClick={() => { setZoomDomain([fns.q1, fns.q3]); setMenuOpen(false) }}
          >
            Zoom to IQR
          </button>
          {isZoomed && (
            <button style={menuItemStyle()} onClick={() => { setZoomDomain(null); setMenuOpen(false) }}>
              Reset zoom
            </button>
          )}
        </div>
      )}

      <svg ref={svgRef} width={width} height={svgHeight} style={{ display: 'block' }}>
        {bins.map((bin, i) => {
          const bx = xScale(bin.x0)
          const bw = xScale(bin.x1) - bx
          const bh = (bin.count / maxCount) * plotH
          const by = pad.top + plotH - bh
          const isHovered = hoverBin !== null && hoverBin.x0 === bin.x0 && hoverBin.x1 === bin.x1
          return (
            <rect key={i} x={bx} y={by} width={Math.max(bw - 0.5, 0.5)} height={bh}
              fill={c.faint} opacity={isHovered ? 1 : undefined}
              stroke={isHovered ? c.accent : undefined} strokeWidth={isHovered ? 1 : undefined} />
          )
        })}

        {isComparing && compareBins.map((bin, i) => {
          const bx = xScale(bin.x0)
          const bw = xScale(bin.x1) - bx
          const bh = (bin.count / maxCount) * plotH
          const by = pad.top + plotH - bh
          return (
            <rect key={i} x={bx} y={by} width={Math.max(bw - 0.5, 0.5)} height={bh}
              fill="none" stroke={c.mean} strokeWidth={1} strokeDasharray="2,2" opacity={0.8} />
          )
        })}

        {showDensityCurve && (
          <>
            <path d={kdePath} fill="none" stroke={c.accent} strokeWidth={1.5} />
            {isComparing && (
              <path d={compareKdePath} fill="none" stroke={c.mean} strokeWidth={1.5} strokeDasharray="4,2" />
            )}
          </>
        )}

        <line x1={pad.left} y1={baseline} x2={pad.left + plotW} y2={baseline} stroke={c.secondary} strokeWidth={0.75} />

        {ticks.map((tick, i) => {
          const tx = xScale(tick)
          if (tx < pad.left || tx > pad.left + plotW) return null
          return (
            <g key={i}>
              <line x1={tx} y1={baseline} x2={tx} y2={baseline + 4} stroke={c.secondary} strokeWidth={0.75} />
              <text x={tx} y={baseline + 14} textAnchor="middle" fontSize={tickFontSize} fill={c.secondary} fontFamily={f.family}>
                {fmtAxis(tick)}
              </text>
            </g>
          )
        })}

        {/* Box plot strip overlay - a second, dashed row for the compare
            snapshot renders directly below the primary one when comparing. */}
        {(() => {
          function boxStrip(
            bpY: number,
            stripFns: typeof fns,
            stripWb: { lower: number; upper: number },
            stripMean: number,
            stripOutliers: number[],
            dashed: boolean,
            color: { whisker: string; box: string; median: string; mean: string },
          ) {
            const bpH = 8
            const capH = 4
            const xWL = clampX(stripWb.lower)
            const xWU = clampX(stripWb.upper)
            const xQ1 = clampX(stripFns.q1)
            const xQ3 = clampX(stripFns.q3)
            const xMed = clampX(stripFns.median)
            const xMn = clampX(stripMean)
            const dash = dashed ? '3,2' : undefined
            return (
              <g>
                <line x1={xWL} y1={bpY} x2={xQ1} y2={bpY} stroke={color.whisker} strokeWidth={1} strokeDasharray={dash} />
                <line x1={xQ3} y1={bpY} x2={xWU} y2={bpY} stroke={color.whisker} strokeWidth={1} strokeDasharray={dash} />
                <line x1={xWL} y1={bpY - capH / 2} x2={xWL} y2={bpY + capH / 2} stroke={color.whisker} strokeWidth={1} />
                <line x1={xWU} y1={bpY - capH / 2} x2={xWU} y2={bpY + capH / 2} stroke={color.whisker} strokeWidth={1} />
                <rect
                  x={xQ1} y={bpY - bpH / 2} width={Math.max(0, xQ3 - xQ1)} height={bpH}
                  fill={dashed ? 'none' : c.faint} stroke={color.box} strokeWidth={1} strokeDasharray={dash} rx={1}
                />
                <line x1={xMed} y1={bpY - bpH / 2} x2={xMed} y2={bpY + bpH / 2} stroke={color.median} strokeWidth={1.5} />
                {dashed ? (
                  <polygon
                    points={`${xMn},${bpY - 3} ${xMn + 2.5},${bpY} ${xMn},${bpY + 3} ${xMn - 2.5},${bpY}`}
                    fill="none" stroke={color.mean} strokeWidth={1.2}
                  />
                ) : (
                  <polygon
                    points={`${xMn},${bpY - 3} ${xMn + 2.5},${bpY} ${xMn},${bpY + 3} ${xMn - 2.5},${bpY}`}
                    fill={color.mean} opacity={0.8}
                  />
                )}
                {stripOutliers.map((v, i) => (
                  <circle key={i} cx={clampX(v)} cy={bpY} r={1.5} fill={color.whisker} opacity={0.5}>
                    <title>{fmtAxis(v)}</title>
                  </circle>
                ))}
              </g>
            )
          }

          const primaryColors = { whisker: c.secondary, box: c.accent, median: c.primary, mean: c.mean }
          const compareColors = { whisker: c.mean, box: c.mean, median: c.mean, mean: c.mean }

          return (
            <>
              {boxStrip(baseline + 22, fns, wb, dataMean, dataOutliers, false, primaryColors)}
              {isComparing && compareFns && compareWb && compareMean !== null && (
                boxStrip(baseline + 38, compareFns, compareWb, compareMean, compareOutliers, true, compareColors)
              )}
            </>
          )
        })()}

        {placedMarkers.map((m, i) => {
          const rowY = baseline + m.row * rowHeight
          const isMedian = m.label.includes('median')
          const isMean = m.label.includes('mean')
          // Combined labels (e.g. "min/Q1/median") can be wide; centering
          // them right at the plot edge would clip off-screen, so anchor
          // from the near edge instead of straddling it.
          const edgeMargin = 40
          const textAnchor: 'start' | 'middle' | 'end' =
            m.x < pad.left + edgeMargin ? 'start' :
            m.x > pad.left + plotW - edgeMargin ? 'end' : 'middle'
          return (
            <g key={i}>
              <line
                x1={m.x} y1={pad.top} x2={m.x} y2={baseline}
                stroke={m.color}
                strokeWidth={isMedian ? 1.5 : 1}
                strokeDasharray={isMean ? '3,2' : isMedian ? 'none' : '2,3'}
                opacity={0.7}
              />
              <polygon points={`${m.x},${baseline} ${m.x - 3},${baseline + 5} ${m.x + 3},${baseline + 5}`} fill={m.color} />
              <text x={m.x} y={rowY + 36} textAnchor={textAnchor} fontSize={markerLabelFontSize}
                fontWeight={isMedian ? 600 : 400} fill={m.color} fontFamily={f.family}>
                {m.label}
              </text>
              <text x={m.x} y={rowY + 47} textAnchor={textAnchor} fontSize={markerValueFontSize}
                fill={m.color} fontFamily={f.family} opacity={0.8}>
                {fmtAxis(m.value)}
              </text>
            </g>
          )
        })}

        {/* "Mark my value" annotation - always rendered when given, independent
            of isComparing (unlike the six stat markers above, which are
            suppressed when comparing to reduce clutter: this is a single
            external reference point, not a redundant per-dataset stat) and
            never merged into the same-display-value grouping pass above -
            the entire point of this feature is that it stands out on its own. */}
        {hasHighlight && (() => {
          const hx = clampX(highlightValue!)
          const flagTop = pad.top - 12
          const edgeMargin = 40
          const textAnchor: 'start' | 'middle' | 'end' =
            hx < pad.left + edgeMargin ? 'start' :
            hx > pad.left + plotW - edgeMargin ? 'end' : 'middle'
          return (
            <g>
              <line x1={hx} y1={flagTop} x2={hx} y2={baseline} stroke={highlightColor} strokeWidth={1.5} />
              <polygon points={`${hx - 4},${flagTop} ${hx + 4},${flagTop} ${hx},${flagTop + 7}`} fill={highlightColor} />
              {highlightLabel && (
                <text x={hx} y={flagTop - 2} textAnchor={textAnchor} fontSize={tickFontSize}
                  fontWeight={600} fill={highlightColor} fontFamily={f.family}>
                  {highlightLabel}
                </text>
              )}
            </g>
          )
        })()}

        {/* Drag-to-zoom selection preview */}
        {dragStartPx !== null && dragCurrentPx !== null && (
          <rect
            x={Math.min(dragStartPx, dragCurrentPx)}
            y={pad.top}
            width={Math.abs(dragCurrentPx - dragStartPx)}
            height={plotH}
            fill={c.primary}
            opacity={0.12}
            stroke={c.primary}
            strokeWidth={1}
            strokeDasharray="3,2"
          />
        )}

        {/* Invisible capture layer for drag-to-zoom, kept on top so it
            receives mouse events over the bars/curve beneath it - which also
            makes it the natural place to detect bar hover, since individual
            bar <rect>s underneath never get a mouse event of their own. */}
        <rect
          x={pad.left} y={pad.top} width={plotW} height={plotH}
          fill="transparent"
          style={{ cursor: 'crosshair' }}
          onMouseDown={e => {
            const rect = svgRef.current?.getBoundingClientRect()
            if (!rect) return
            const localX = e.clientX - rect.left
            setDragStartPx(localX)
            setDragCurrentPx(localX)
            setHoverBin(null)
          }}
          onMouseMove={e => {
            if (dragStartPx !== null) return // dragging shows its own selection preview instead
            const rect = svgRef.current?.getBoundingClientRect()
            if (!rect) return
            const localX = e.clientX - rect.left
            const value = invertX(localX)
            const idx = Math.max(0, Math.min(bins.length - 1, Math.floor((value - xMin) / binWidth)))
            const bin = bins[idx]
            setHoverBin({
              x0: bin.x0, x1: bin.x1, count: bin.count,
              compareCount: isComparing ? compareBins[idx]?.count : undefined,
              clientX: e.clientX, clientY: e.clientY,
            })
          }}
          onMouseLeave={() => setHoverBin(null)}
        >
          <title>Drag to zoom in</title>
        </rect>
      </svg>

      {hoverBin && (
        <div style={{
          position: 'fixed',
          left: Math.min(hoverBin.clientX + 12, window.innerWidth - 160),
          top: Math.min(hoverBin.clientY + 12, window.innerHeight - 70),
          background: t.bg, border: `1px solid ${t.border}`, borderRadius: 4,
          padding: '6px 8px', fontSize: f.labelSize, fontFamily: f.family,
          color: t.text, boxShadow: t.shadow, pointerEvents: 'none',
          zIndex: 1, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 600 }}>{fmtAxis(hoverBin.x0)}–{fmtAxis(hoverBin.x1)}</div>
          {isComparing ? (
            <>
              <div style={{ color: c.primary }}>{label}: {hoverBin.count.toLocaleString()}</div>
              <div style={{ color: c.mean }}>{compareLabel}: {(hoverBin.compareCount ?? 0).toLocaleString()}</div>
            </>
          ) : (
            <div style={{ color: t.textMuted }}>
              {hoverBin.count.toLocaleString()} value{hoverBin.count === 1 ? '' : 's'}
              {visibleData.length > 0 ? ` (${((hoverBin.count / visibleData.length) * 100).toFixed(1)}%)` : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
