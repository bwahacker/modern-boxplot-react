import { useMemo } from 'react'
import type { CategoricalSummary } from '../stats/categorical'
import { categoricalNormalFit } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface CategoricalBarChartProps {
  summary: CategoricalSummary
  width?: number
  height?: number
  theme: BoxPlotTheme
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s
}

export function CategoricalBarChart({
  summary,
  width = 420,
  height = 220,
  theme,
}: CategoricalBarChartProps) {
  const pad = { top: 12, right: 16, bottom: 52, left: 16 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const c = theme.colors
  const f = theme.font

  const cats = summary.categories
  const maxCount = Math.max(...cats.map(ct => ct.count), 1)

  const fit = useMemo(() => categoricalNormalFit(cats), [cats])

  if (cats.length === 0) return null

  const barW = plotW / cats.length
  const gap = Math.max(1, barW * 0.15)
  const baseline = pad.top + plotH

  // Fitted discrete Gaussian curve points
  const gaussianPoints: { x: number; y: number }[] = useMemo(() => {
    if (cats.length < 3 || fit.similarity < 0.1) return []
    const total = summary.totalCount
    const wMean = cats.reduce((s, ct) => s + ct.position * ct.count, 0) / total
    let wVar = 0
    for (const ct of cats) wVar += ct.count * (ct.position - wMean) ** 2
    const wStd = Math.sqrt(wVar / total) || 1

    return cats.map((ct, i) => {
      const z = (ct.position - wMean) / wStd
      const density = Math.exp(-0.5 * z * z)
      // Normalize so the peak matches the highest bar's expected count
      const expectedTotal = cats.reduce((s, c2) => {
        const z2 = (c2.position - wMean) / wStd
        return s + Math.exp(-0.5 * z2 * z2)
      }, 0)
      const expectedCount = (density / expectedTotal) * total
      const x = pad.left + (i + 0.5) * barW
      const y = pad.top + plotH - (expectedCount / maxCount) * plotH
      return { x, y }
    })
  }, [cats, fit.similarity, maxCount, summary.totalCount])

  const curvePath = gaussianPoints.length > 0
    ? gaussianPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    : ''

  // Determine if we need to rotate labels
  const maxLabelLen = Math.max(...cats.map(ct => ct.label.length))
  const charWidth = 5.5 // approximate px per char at fontSize 9
  const labelFits = maxLabelLen * charWidth < barW - 2
  const rotateLabels = !labelFits

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Bars */}
      {cats.map((cat, i) => {
        const bx = pad.left + i * barW + gap / 2
        const bw = Math.max(1, barW - gap)
        const bh = (cat.count / maxCount) * plotH
        const by = pad.top + plotH - bh
        const isMode = cat.label === summary.mode
        return (
          <g key={i}>
            <rect
              x={bx}
              y={by}
              width={bw}
              height={bh}
              fill={isMode ? c.primary : c.faint}
              stroke={isMode ? c.primary : c.secondary}
              strokeWidth={0.5}
              rx={1}
            />
            {/* Count label above bar */}
            <text
              x={bx + bw / 2}
              y={by - 3}
              textAnchor="middle"
              fontSize={8}
              fill={c.secondary}
              fontFamily={f.family}
            >
              {cat.count}
            </text>
          </g>
        )
      })}

      {/* Fitted Gaussian curve */}
      {curvePath && (
        <path d={curvePath} fill="none" stroke={c.accent} strokeWidth={1.5} opacity={0.6} />
      )}

      {/* Baseline */}
      <line
        x1={pad.left} y1={baseline}
        x2={pad.left + plotW} y2={baseline}
        stroke={c.secondary} strokeWidth={0.75}
      />

      {/* Category labels */}
      {cats.map((cat, i) => {
        const cx = pad.left + (i + 0.5) * barW
        const label = truncate(cat.label, rotateLabels ? 12 : 8)
        const isMode = cat.label === summary.mode

        if (rotateLabels) {
          return (
            <text
              key={i}
              x={cx}
              y={baseline + 8}
              textAnchor="end"
              fontSize={8.5}
              fill={isMode ? c.primary : c.secondary}
              fontWeight={isMode ? 600 : 400}
              fontFamily={f.family}
              transform={`rotate(-40, ${cx}, ${baseline + 8})`}
            >
              {label}
            </text>
          )
        }

        return (
          <text
            key={i}
            x={cx}
            y={baseline + 14}
            textAnchor="middle"
            fontSize={9}
            fill={isMode ? c.primary : c.secondary}
            fontWeight={isMode ? 600 : 400}
            fontFamily={f.family}
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}
