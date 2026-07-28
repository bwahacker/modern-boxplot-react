import { useEffect, useMemo, useRef, useState } from 'react'
import { binData, kernelDensity } from '../stats/histogram'
import { fiveNumberSummary, mean as calcMean, whiskerBounds, outliers as calcOutliers } from '../stats/descriptive'
import { linearScale, symlogScale, defaultLinthresh, type AxisScale } from '../stats/scale'
import type { BoxPlotTheme } from '../themes'

interface HistogramProps {
  data: number[]
  width?: number
  height?: number
  theme: BoxPlotTheme
}

type ScaleMode = 'linear' | 'symlog'

function fmtAxis(n: number): string {
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(0) + 'k'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k'
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  if (Math.abs(n) >= 1) return n.toFixed(1)
  return n.toFixed(2)
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

export function Histogram({ data, width = 420, height = 232, theme }: HistogramProps) {
  const pad = { top: 12, right: 16, bottom: 64, left: 16 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const c = theme.colors
  const t = theme.popover
  const f = theme.font
  // SVG chart text defaults to the theme's label size rather than small
  // hardcoded pixel values, so it scales with the rest of the UI.
  const tickFontSize = f.labelSize
  const markerLabelFontSize = f.labelSize
  const markerValueFontSize = f.labelSize - 0.5

  const svgRef = useRef<SVGSVGElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [scaleMode, setScaleMode] = useState<ScaleMode>('linear')
  const [zoomDomain, setZoomDomain] = useState<[number, number] | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dragStartPx, setDragStartPx] = useState<number | null>(null)
  const [dragCurrentPx, setDragCurrentPx] = useState<number | null>(null)

  // Stats always reflect the full column, regardless of zoom.
  const fns = useMemo(() => fiveNumberSummary(data), [data])
  const dataMean = useMemo(() => calcMean(data), [data])
  const wb = useMemo(() => whiskerBounds(data), [data])
  const dataOutliers = useMemo(() => calcOutliers(data), [data])
  const trueMin = fns.min
  const trueMax = fns.max

  // Bins/KDE are recomputed from just the zoomed-in subset, so zooming both
  // narrows the axis and reveals finer bin resolution - not just a visual crop.
  const visibleData = useMemo(() => {
    if (!zoomDomain) return data
    const [lo, hi] = zoomDomain
    return data.filter(v => v >= lo && v <= hi)
  }, [data, zoomDomain])

  const bins = useMemo(() => binData(visibleData), [visibleData])
  const kde = useMemo(() => kernelDensity(visibleData, 80), [visibleData])

  const maxCount = Math.max(...bins.map(b => b.count), 1)
  const maxDensity = Math.max(...kde.map(p => p.y), 1e-10)

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

  if (bins.length === 0) return null

  const xMin = bins[0].x0
  const xMax = bins[bins.length - 1].x1
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

  const baseline = pad.top + plotH

  const rawMarkers: { value: number; label: string; color: string; priority: number }[] = [
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
  const rowHeight = 22
  const minGap = 34
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
  const maxRow = rowsX.length - 1

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
          return (
            <rect key={i} x={bx} y={by} width={Math.max(bw - 0.5, 0.5)} height={bh} fill={c.faint} />
          )
        })}

        <path d={kdePath} fill="none" stroke={c.accent} strokeWidth={1.5} />

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

        {/* Box plot strip overlay */}
        {(() => {
          const bpY = baseline + 22  // center of the strip, below tick labels
          const bpH = 8              // box height
          const capH = 4             // whisker cap height
          const xWL = clampX(wb.lower)
          const xWU = clampX(wb.upper)
          const xQ1 = clampX(fns.q1)
          const xQ3 = clampX(fns.q3)
          const xMed = clampX(fns.median)
          const xMn = clampX(dataMean)
          return (
            <g>
              {/* Whisker lines */}
              <line x1={xWL} y1={bpY} x2={xQ1} y2={bpY} stroke={c.secondary} strokeWidth={1} />
              <line x1={xQ3} y1={bpY} x2={xWU} y2={bpY} stroke={c.secondary} strokeWidth={1} />
              {/* Whisker caps */}
              <line x1={xWL} y1={bpY - capH / 2} x2={xWL} y2={bpY + capH / 2} stroke={c.secondary} strokeWidth={1} />
              <line x1={xWU} y1={bpY - capH / 2} x2={xWU} y2={bpY + capH / 2} stroke={c.secondary} strokeWidth={1} />
              {/* IQR box */}
              <rect
                x={xQ1} y={bpY - bpH / 2} width={Math.max(0, xQ3 - xQ1)} height={bpH}
                fill={c.faint} stroke={c.accent} strokeWidth={1} rx={1}
              />
              {/* Median tick */}
              <line x1={xMed} y1={bpY - bpH / 2} x2={xMed} y2={bpY + bpH / 2} stroke={c.primary} strokeWidth={1.5} />
              {/* Mean marker (small diamond) */}
              <polygon
                points={`${xMn},${bpY - 3} ${xMn + 2.5},${bpY} ${xMn},${bpY + 3} ${xMn - 2.5},${bpY}`}
                fill={c.mean} opacity={0.8}
              />
              {/* Outlier dots */}
              {dataOutliers.map((v, i) => (
                <circle key={i} cx={clampX(v)} cy={bpY} r={1.5} fill={c.secondary} opacity={0.5} />
              ))}
            </g>
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
            receives mouse events over the bars/curve beneath it. */}
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
          }}
        >
          <title>Drag to zoom in</title>
        </rect>
      </svg>
    </div>
  )
}
