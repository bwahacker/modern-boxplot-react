import { useMemo } from 'react'
import type { CategoricalSummary } from '../stats/categorical'
import { categoricalNormalFit } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface CategoricalBarChartProps {
  summary: CategoricalSummary
  width?: number
  height?: number
  theme: BoxPlotTheme
  /** A second summary to compare against `summary`, as grouped bars. Must share `summary`'s category order (see `mergedCategoryOrder`). */
  compareSummary?: CategoricalSummary
  /** Label for the primary snapshot, shown only when `compareSummary` is present. */
  label?: string
  /** Label for the comparison snapshot, shown only when `compareSummary` is present. */
  compareLabel?: string
  /** Mark a specific category with a small flag above its bar. Kept separate from the isMode bold-bar styling so a category that's simultaneously the mode and the highlight shows both cues. */
  highlightCategory?: string
  /** Optional text shown above the highlight flag. No auto-computed percentile label for categorical data - pass this explicitly if you want one. */
  highlightLabel?: string
  /** Overlay a fitted Gaussian curve on top of the bars. Off by default - it reads as clutter/noise on most real category distributions, especially high-cardinality ones. */
  showFitCurve?: boolean
  /** Scales up chart typography for the popover's full-screen mode. */
  fullscreen?: boolean
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '\u2026' : s
}

export function CategoricalBarChart({
  summary,
  width = 420,
  height = 220,
  theme,
  compareSummary,
  label = 'Current',
  compareLabel = 'Comparison',
  highlightCategory,
  highlightLabel,
  showFitCurve = false,
  fullscreen = false,
}: CategoricalBarChartProps) {
  const isComparing = !!compareSummary
  const hasHighlight = highlightCategory !== undefined
  // Extra headroom for the highlight flag + label, reserved the same way
  // Histogram reserves space for its own highlight marker - including the
  // same extra legend-clearance push-down when also comparing, so the
  // highlight label never collides with the compare legend's HTML overlay.
  const highlightLegendClearance = hasHighlight && isComparing ? 14 : 0
  const pad = { top: 12 + (hasHighlight ? 16 : 0) + highlightLegendClearance, right: 16, bottom: 56, left: 16 }
  const plotW = width - pad.left - pad.right
  const plotH = height - pad.top - pad.bottom
  const c = theme.colors
  const f = theme.font
  const highlightColor = c.highlight ?? c.mean
  // SVG chart text defaults to the theme's label size rather than small
  // hardcoded pixel values, so it scales with the rest of the UI. Everything
  // downstream (charWidth, labelFits, rotateLabels, minRotatedSpacing) is
  // already derived from these, not hardcoded, so scaling them for
  // fullscreen keeps the label-collision math self-consistent for free.
  const fx = fullscreen ? 1.3 : 1
  const axisFontSize = f.labelSize * fx
  const countFontSize = f.labelSize * fx
  const charWidth = axisFontSize * 0.62

  const cats = summary.categories
  const maxCount = Math.max(
    ...cats.map(ct => ct.count),
    ...(compareSummary ? compareSummary.categories.map(ct => ct.count) : []),
    1,
  )

  const compareCatsByLabel = useMemo(() => {
    if (!compareSummary) return null
    return new Map(compareSummary.categories.map(cc => [cc.label, cc]))
  }, [compareSummary])

  const fit = useMemo(() => categoricalNormalFit(cats), [cats])

  if (cats.length === 0) return null

  const barW = plotW / cats.length
  const gap = Math.max(1, barW * 0.15)
  const baseline = pad.top + plotH
  const highlightIndex = hasHighlight ? cats.findIndex(ct => ct.label === highlightCategory) : -1

  // Hide per-bar count numbers entirely rather than let them overlap when
  // there are too many narrow bars to fit them (the frequency table below
  // still lists every exact count).
  const maxCountLen = Math.max(...cats.map(ct => String(ct.count).length))
  const showCountLabels = maxCountLen * charWidth + 4 < barW

  // Fitted discrete Gaussian curve points - off by default (see showFitCurve).
  const gaussianPoints: { x: number; y: number }[] = useMemo(() => {
    if (!showFitCurve || cats.length < 3 || fit.similarity < 0.1) return []
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
  }, [showFitCurve, cats, fit.similarity, maxCount, summary.totalCount])

  const curvePath = gaussianPoints.length > 0
    ? gaussianPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
    : ''

  // Determine if we need to rotate labels
  const maxLabelLen = Math.max(...cats.map(ct => ct.label.length))
  const labelFits = maxLabelLen * charWidth < barW - 2
  const rotateLabels = !labelFits

  // Even rotated, labels packed edge-to-edge onto narrow bars just overlap
  // each other instead. Once bars get too narrow for that, thin them out
  // (show every Nth one, always keeping the mode) rather than crowd them.
  const minRotatedSpacing = axisFontSize * 2.2
  const labelStep = rotateLabels ? Math.max(1, Math.ceil(minRotatedSpacing / barW)) : 1

  return (
    <div style={{ position: 'relative' }}>
      {isComparing && (
        <div style={{
          position: 'absolute', top: 0, left: pad.left,
          display: 'flex', gap: 10, fontSize: axisFontSize, fontFamily: f.family,
          pointerEvents: 'none',
        }}>
          <span style={{ color: c.primary }}>― {label}</span>
          <span style={{ color: c.mean }}>┄ {compareLabel}</span>
        </div>
      )}

      <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Bars - grouped (primary + compare) when comparing */}
      {cats.map((cat, i) => {
        const groupX = pad.left + i * barW
        const isMode = cat.label === summary.mode

        if (!isComparing) {
          const bx = groupX + gap / 2
          const bw = Math.max(1, barW - gap)
          const bh = (cat.count / maxCount) * plotH
          const by = pad.top + plotH - bh
          return (
            <g key={i}>
              <rect
                x={bx} y={by} width={bw} height={bh}
                fill={isMode ? c.primary : c.faint}
                stroke={isMode ? c.primary : c.secondary}
                strokeWidth={0.5}
                rx={1}
              />
              {/* Count label above bar */}
              {showCountLabels && (
                <text
                  x={bx + bw / 2}
                  y={by - 3}
                  textAnchor="middle"
                  fontSize={countFontSize}
                  fill={c.secondary}
                  fontFamily={f.family}
                >
                  {cat.count}
                </text>
              )}
            </g>
          )
        }

        const compareCount = compareCatsByLabel!.get(cat.label)?.count ?? 0
        const innerGap = Math.max(0.5, barW * 0.04)
        const subBarW = Math.max(1, (barW - gap - innerGap) / 2)
        const primaryBx = groupX + gap / 2
        const compareBx = primaryBx + subBarW + innerGap
        const primaryBh = (cat.count / maxCount) * plotH
        const compareBh = (compareCount / maxCount) * plotH

        return (
          <g key={i}>
            <rect
              x={primaryBx} y={pad.top + plotH - primaryBh} width={subBarW} height={primaryBh}
              fill={isMode ? c.primary : c.faint}
              stroke={isMode ? c.primary : c.secondary}
              strokeWidth={0.5}
              rx={1}
            />
            <rect
              x={compareBx} y={pad.top + plotH - compareBh} width={subBarW} height={compareBh}
              fill="none" stroke={c.mean} strokeWidth={1} strokeDasharray="2,2" opacity={0.85} rx={1}
            />
          </g>
        )
      })}

      {/* Highlight flag - a small marker above the matching bar, kept
          separate from the isMode bold-bar styling above. */}
      {highlightIndex >= 0 && (() => {
        const hcx = pad.left + (highlightIndex + 0.5) * barW
        return (
          <g>
            <polygon points={`${hcx - 4},${pad.top - 8} ${hcx + 4},${pad.top - 8} ${hcx},${pad.top - 1}`} fill={highlightColor} />
            {highlightLabel && (
              <text x={hcx} y={pad.top - 10} textAnchor="middle" fontSize={axisFontSize}
                fontWeight={600} fill={highlightColor} fontFamily={f.family}>
                {highlightLabel}
              </text>
            )}
          </g>
        )
      })()}

      {/* Fitted Gaussian curve - suppressed when comparing (a good fit for
          one snapshot says nothing about the other, and the diff card
          already covers shape comparison). */}
      {curvePath && !isComparing && (
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
        const isMode = cat.label === summary.mode
        if (i % labelStep !== 0 && !isMode) return null

        const cx = pad.left + (i + 0.5) * barW
        const label = truncate(cat.label, rotateLabels ? 12 : 8)

        if (rotateLabels) {
          return (
            <text
              key={i}
              x={cx}
              y={baseline + 8}
              textAnchor="end"
              fontSize={axisFontSize}
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
            fontSize={axisFontSize}
            fill={isMode ? c.primary : c.secondary}
            fontWeight={isMode ? 600 : 400}
            fontFamily={f.family}
          >
            {label}
          </text>
        )
      })}
      </svg>
    </div>
  )
}
