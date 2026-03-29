import type { CategoricalSummary } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface CategoricalStatsSummaryProps {
  summary: CategoricalSummary
  theme: BoxPlotTheme
}

export function CategoricalStatsSummary({ summary, theme }: CategoricalStatsSummaryProps) {
  const t = theme.popover
  const f = theme.font

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Frequency table */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: f.valueSize - 1,
        marginBottom: 10,
      }}>
        <thead>
          <tr>
            <th style={thStyle(t, f)}>Category</th>
            <th style={{ ...thStyle(t, f), textAlign: 'right' }}>Count</th>
            <th style={{ ...thStyle(t, f), textAlign: 'right' }}>%</th>
          </tr>
        </thead>
        <tbody>
          {summary.categories.map(cat => (
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
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px 12px',
      }}>
        <StatCell label="n" value={String(summary.totalCount)} theme={theme} />
        <StatCell label="categories" value={String(summary.numCategories)} theme={theme} />
        <StatCell label="mode" value={summary.mode} theme={theme} />
        <StatCell label="entropy" value={summary.entropy.toFixed(2) + ' bits'} theme={theme} />
      </div>
    </div>
  )
}

function StatCell({ label, value, theme }: { label: string; value: string; theme: BoxPlotTheme }) {
  const t = theme.popover
  const f = theme.font
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 60 }}>
      <span style={{
        fontSize: f.labelSize,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: t.textMuted,
        fontWeight: 400,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: f.valueSize,
        color: t.text,
        fontWeight: 500,
      }}>
        {value}
      </span>
    </div>
  )
}

function thStyle(t: BoxPlotTheme['popover'], f: BoxPlotTheme['font']): React.CSSProperties {
  return {
    textAlign: 'left',
    padding: '4px 6px',
    fontSize: f.labelSize,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: t.textMuted,
    fontWeight: 400,
    borderBottom: `1.5px solid ${t.rule}`,
  }
}
