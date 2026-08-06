import { DescriptiveStats } from '../stats/descriptive'
import type { BoxPlotTheme } from '../themes'

interface StatsSummaryProps {
  stats: DescriptiveStats
  theme: BoxPlotTheme
  /** Scales up typography and widens the grid for the popover's full-screen mode. */
  fullscreen?: boolean
}

function fmt(n: number, decimals: number = 2): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(1)
  return n.toFixed(decimals)
}

export function StatsSummary({ stats, theme, fullscreen = false }: StatsSummaryProps) {
  const t = theme.popover
  const f = theme.font

  const entries: [string, number][] = [
    ['n', stats.n],
    ['min', stats.min],
    ['Q1', stats.q1],
    ['median', stats.median],
    ['Q3', stats.q3],
    ['max', stats.max],
    ['mean', stats.mean],
    ['std', stats.stddev],
  ]

  return (
    <div style={{
      display: 'grid',
      // Fullscreen has enough width to lay all 8 stats out in a single row
      // instead of wrapping to two - the point of the full-screen mode being
      // to actually use the extra space, not just leave it blank.
      gridTemplateColumns: fullscreen ? 'repeat(8, 1fr)' : 'repeat(4, 1fr)',
      gap: fullscreen ? '10px 16px' : '8px 12px',
      padding: '0 4px',
    }}>
      {entries.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 60 }}>
          <span style={{
            fontSize: fullscreen ? f.labelSize * 1.2 : f.labelSize,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: t.textMuted,
            fontWeight: 400,
          }}>
            {label}
          </span>
          <span style={{
            fontSize: fullscreen ? f.valueSize * 1.4 : f.valueSize,
            color: t.text,
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 500,
          }}>
            {label === 'n' ? value : fmt(value)}
          </span>
        </div>
      ))}
    </div>
  )
}
