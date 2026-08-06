import { useMemo } from 'react'
import type { CategoricalSummary } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface CategoricalStatsSummaryProps {
  summary: CategoricalSummary
  theme: BoxPlotTheme
  /** A second summary to compare against `summary` - adds compare count/% columns to the frequency table. */
  compareSummary?: CategoricalSummary
  label?: string
  compareLabel?: string
  /** Scales up typography for the popover's full-screen mode. */
  fullscreen?: boolean
}

export function CategoricalStatsSummary({
  summary, theme, compareSummary, label = 'Current', compareLabel = 'Comparison', fullscreen = false,
}: CategoricalStatsSummaryProps) {
  const t = theme.popover
  const f = theme.font
  const displayTotal = summary.trueTotalCount ?? summary.totalCount
  const displayCategories = summary.trueUniqueCount ?? summary.numCategories
  const isComparing = !!compareSummary
  const fx = fullscreen ? 1.3 : 1

  const compareCatsByLabel = useMemo(() => {
    if (!compareSummary) return null
    return new Map(compareSummary.categories.map(c => [c.label, c]))
  }, [compareSummary])

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Frequency table */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: (f.valueSize - 1) * fx,
        marginBottom: 10,
      }}>
        <thead>
          <tr>
            <th style={thStyle(t, f, fx)}>Category</th>
            <th style={{ ...thStyle(t, f, fx), textAlign: 'right' }}>{isComparing ? `${label} count` : 'Count'}</th>
            <th style={{ ...thStyle(t, f, fx), textAlign: 'right' }}>%</th>
            {isComparing && (
              <>
                <th style={{ ...thStyle(t, f, fx), textAlign: 'right' }}>{compareLabel} count</th>
                <th style={{ ...thStyle(t, f, fx), textAlign: 'right' }}>%</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {summary.categories.map(cat => {
            const compareCat = compareCatsByLabel?.get(cat.label)
            return (
              <tr key={cat.label} style={{ borderBottom: `1px solid ${t.rule}` }}>
                <td style={{
                  padding: '4px 6px',
                  color: cat.label === summary.mode ? t.text : t.textMuted,
                  fontWeight: cat.label === summary.mode ? 600 : 400,
                }}>
                  {cat.label}
                </td>
                <td style={{
                  padding: '4px 6px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: t.text,
                }}>
                  {cat.count}
                </td>
                <td style={{
                  padding: '4px 6px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: t.textMuted,
                }}>
                  {(cat.proportion * 100).toFixed(1)}%
                </td>
                {isComparing && (
                  <>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.text }}>
                      {compareCat?.count ?? 0}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: t.textMuted }}>
                      {((compareCat?.proportion ?? 0) * 100).toFixed(1)}%
                    </td>
                  </>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Summary metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: fullscreen ? '10px 16px' : '8px 12px',
      }}>
        <StatCell label="n" value={displayTotal.toLocaleString()} theme={theme} fullscreen={fullscreen} />
        <StatCell label="categories" value={displayCategories.toLocaleString()} theme={theme} fullscreen={fullscreen} />
        <StatCell label="mode" value={summary.mode} theme={theme} fullscreen={fullscreen} />
        <StatCell
          label={summary.isTruncated ? `entropy (top ${summary.numCategories})` : 'entropy'}
          value={summary.entropy.toFixed(2) + ' bits'}
          theme={theme}
          fullscreen={fullscreen}
        />
      </div>

      {summary.isTruncated && (
        <div style={{ fontSize: f.labelSize * fx, color: t.textMuted, lineHeight: 1.4, marginTop: 8 }}>
          Showing top {summary.numCategories.toLocaleString()} of {displayCategories.toLocaleString()} categories
          ({summary.totalCount.toLocaleString()} of {displayTotal.toLocaleString()} values). Entropy and bell-curve
          fit are computed from the categories shown only.
        </div>
      )}
    </div>
  )
}

function StatCell({ label, value, theme, fullscreen }: { label: string; value: string; theme: BoxPlotTheme; fullscreen?: boolean }) {
  const t = theme.popover
  const f = theme.font
  const fx = fullscreen ? 1.3 : 1
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 60 }}>
      <span style={{
        fontSize: f.labelSize * fx,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: t.textMuted,
        fontWeight: 400,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: f.valueSize * fx,
        color: t.text,
        fontWeight: 500,
      }}>
        {value}
      </span>
    </div>
  )
}

function thStyle(t: BoxPlotTheme['popover'], f: BoxPlotTheme['font'], fx: number = 1): React.CSSProperties {
  return {
    textAlign: 'left',
    padding: '4px 6px',
    fontSize: f.labelSize * fx,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: t.textMuted,
    fontWeight: 400,
    borderBottom: `1.5px solid ${t.rule}`,
  }
}
