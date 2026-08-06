import { diffDescriptiveStats, diffDistributionMatch, type DiffSeverity, type StatDelta } from '../stats/diff'
import type { DescriptiveStats } from '../stats/descriptive'
import type { DistributionMatch } from '../stats/distribution-match'
import type { BoxPlotTheme } from '../themes'

interface DistributionDiffSummaryProps {
  stats: DescriptiveStats
  compareStats: DescriptiveStats
  matches: DistributionMatch[]
  compareMatches: DistributionMatch[]
  theme: BoxPlotTheme
  label?: string
  compareLabel?: string
  /** Show the shape-match verdict (e.g. "Unchanged: Log-Normal"). Defaults to true. */
  showDistributionMatch?: boolean
  /** Scales up typography for the popover's full-screen mode. */
  fullscreen?: boolean
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (Math.abs(n) < 0.01 && n !== 0) return n.toExponential(1)
  return n.toFixed(2)
}

function fmtDelta(key: string, delta: StatDelta): string {
  const magnitude = key === 'n' ? Math.round(delta.delta).toLocaleString() : fmt(delta.delta)
  const sign = delta.delta >= 0 ? '+' : ''
  const pct = delta.deltaPct !== null ? ` (${delta.deltaPct >= 0 ? '+' : ''}${(delta.deltaPct * 100).toFixed(0)}%)` : ''
  return `${sign}${magnitude}${pct}`
}

function severityColor(theme: BoxPlotTheme, severity?: DiffSeverity): string {
  if (severity === 'major') return theme.colors.mean
  if (severity === 'notable') return theme.colors.accent
  return theme.popover.text
}

export function DistributionDiffSummary({
  stats, compareStats, matches, compareMatches, theme, label = 'Current', compareLabel = 'Comparison',
  showDistributionMatch = true, fullscreen = false,
}: DistributionDiffSummaryProps) {
  const t = theme.popover
  const f = theme.font
  const fx = fullscreen ? 1.3 : 1
  const diff = diffDescriptiveStats(stats, compareStats)
  const shapeDiff = diffDistributionMatch(matches, compareMatches)

  const rows: { key: string; label: string; delta: StatDelta }[] = [
    { key: 'n', label: 'n', delta: diff.n },
    { key: 'mean', label: 'mean', delta: diff.mean },
    { key: 'median', label: 'median', delta: diff.median },
    { key: 'stddev', label: 'std', delta: diff.stddev },
    { key: 'min', label: 'min', delta: diff.min },
    { key: 'max', label: 'max', delta: diff.max },
  ]

  const thStyle: React.CSSProperties = {
    textAlign: 'left', padding: '4px 6px', fontSize: f.labelSize * fx,
    letterSpacing: '0.05em', textTransform: 'uppercase', color: t.textMuted,
    fontWeight: 400, borderBottom: `1.5px solid ${t.rule}`,
  }

  return (
    <div style={{ padding: '0 4px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: (f.valueSize - 1) * fx, marginBottom: 10 }}>
        <thead>
          <tr>
            <th style={thStyle}>Stat</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>{label}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>{compareLabel}</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const flag = diff.flags.find(fl => fl.field === row.key)
            const color = severityColor(theme, flag?.severity)
            return (
              <tr key={row.key} style={{ borderBottom: `1px solid ${t.rule}` }}>
                <td style={{ padding: '4px 6px', color: t.textMuted }}>{row.label}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.text }}>
                  {row.key === 'n' ? row.delta.a.toLocaleString() : fmt(row.delta.a)}
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.text }}>
                  {row.key === 'n' ? row.delta.b.toLocaleString() : fmt(row.delta.b)}
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color, fontWeight: flag ? 600 : 400 }}>
                  {fmtDelta(row.key, row.delta)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {diff.rangeShift.direction !== 'unchanged' && (
        <div style={{ fontSize: 11 * fx, color: t.textMuted, marginBottom: 8 }}>
          Range {diff.rangeShift.direction} ({(diff.rangeShift.magnitude * 100).toFixed(0)}% of the original range).
        </div>
      )}

      {showDistributionMatch && (
        <div>
          <span style={{
            fontSize: f.labelSize * fx, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: t.textMuted,
          }}>
            Shape
          </span>
          <div style={{
            fontSize: 14 * fx, fontWeight: 600, marginTop: 2,
            color: shapeDiff.changed ? severityColor(theme, shapeDiff.isLowConfidence ? 'minor' : 'major') : t.text,
          }}>
            {shapeDiff.changed ? `${shapeDiff.from} → ${shapeDiff.to}` : `Unchanged: ${shapeDiff.from}`}
            <span style={{ fontSize: 12 * fx, fontWeight: 400, color: t.textMuted, marginLeft: 8 }}>
              {Math.round(shapeDiff.fromSimilarity * 100)}% → {Math.round(shapeDiff.toSimilarity * 100)}%
            </span>
          </div>
          {shapeDiff.changed && shapeDiff.isLowConfidence && (
            <div style={{ fontSize: 11 * fx, color: t.textMuted, marginTop: 4, fontStyle: 'italic' }}>
              Both fits are weak - treat this shape change as low-confidence noise, not a meaningful signal.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
