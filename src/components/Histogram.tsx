import { useMemo } from 'react'
import { binData, kernelDensity } from '../stats/histogram'
import { fiveNumberSummary, mean as calcMean } from '../stats/descriptive'
import type { BoxPlotTheme } from '../themes'

interface HistogramProps {
  data: number[]
  width?: number
  height?: number
  theme: BoxPlotTheme
}

function fmtAxis(n: number): string {
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(0) + 'k'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k'
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  if (Math.abs(n) >= 1) return n.toFixed(1)
  return n.toFixed(2)
}

export function Histogram({ data, width = 420, height = 220, theme }: HistogramProps) {
  const pad = { top: 12, right: 16, bottom: 52, left: 16 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const c = theme.colors
  const f = theme.font

  const bins = useMemo(() => binData(data), [data])
  const kde = useMemo(() => kernelDensity(data, 80), [data])
  const fns = useMemo(() => fiveNumberSummary(data), [data])
  const dataMean = useMemo(() => calcMean(data), [data])

  const maxCount = Math.max(...bins.map(b => b.count), 1)
  const maxDensity = Math.max(...kde.map(p => p.y), 1e-10)

  if (bins.length === 0) return null

  const xMin = bins[0].x0
  const xMax = bins[bins.length - 1].x1
  const xRange = xMax - xMin || 1

  const xScale = (v: number) => pad.left + ((v - xMin) / xRange) * plotW
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

  const markers: { value: number; label: string; color: string; priority: number }[] = [
    { value: fns.min, label: 'min', color: c.secondary, priority: 1 },
    { value: fns.q1, label: 'Q1', color: c.accent, priority: 2 },
    { value: fns.median, label: 'median', color: c.primary, priority: 4 },
    { value: dataMean, label: 'mean', color: c.mean, priority: 3 },
    { value: fns.q3, label: 'Q3', color: c.accent, priority: 2 },
    { value: fns.max, label: 'max', color: c.secondary, priority: 1 },
  ]

  const sortedMarkers = [...markers].sort((a, b) => b.priority - a.priority)
  const placedX: number[] = []
  const visibleMarkers = sortedMarkers.filter(m => {
    const mx = clampX(m.value)
    if (placedX.some(px => Math.abs(px - mx) < 28)) return false
    placedX.push(mx)
    return true
  })
  visibleMarkers.sort((a, b) => a.value - b.value)

  const tickCount = 5
  const rawStep = xRange / (tickCount - 1)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const niceSteps = [1, 2, 5, 10]
  const niceStep = niceSteps.find(s => s * magnitude >= rawStep)! * magnitude
  const firstTick = Math.ceil(xMin / niceStep) * niceStep
  const ticks: number[] = []
  for (let t = firstTick; t <= xMax; t += niceStep) ticks.push(t)

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
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
            <text x={tx} y={baseline + 14} textAnchor="middle" fontSize={9} fill={c.secondary} fontFamily={f.family}>
              {fmtAxis(tick)}
            </text>
          </g>
        )
      })}

      {visibleMarkers.map((m, i) => {
        const mx = clampX(m.value)
        return (
          <g key={i}>
            <line
              x1={mx} y1={pad.top} x2={mx} y2={baseline}
              stroke={m.color}
              strokeWidth={m.label === 'median' ? 1.5 : 1}
              strokeDasharray={m.label === 'mean' ? '3,2' : m.label === 'median' ? 'none' : '2,3'}
              opacity={0.7}
            />
            <polygon points={`${mx},${baseline} ${mx - 3},${baseline + 5} ${mx + 3},${baseline + 5}`} fill={m.color} />
            <text x={mx} y={baseline + 28} textAnchor="middle" fontSize={9}
              fontWeight={m.label === 'median' ? 600 : 400} fill={m.color} fontFamily={f.family}>
              {m.label}
            </text>
            <text x={mx} y={baseline + 39} textAnchor="middle" fontSize={8.5}
              fill={m.color} fontFamily={f.family} opacity={0.8}>
              {fmtAxis(m.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
