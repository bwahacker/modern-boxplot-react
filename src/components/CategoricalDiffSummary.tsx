import { diffCategoricalSummary, type DiffSeverity } from '../stats/diff'
import type { CategoricalSummary } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface CategoricalDiffSummaryProps {
  summary: CategoricalSummary
  compareSummary: CategoricalSummary
  theme: BoxPlotTheme
  label?: string
  compareLabel?: string
  /** Scales up typography for the popover's full-screen mode. */
  fullscreen?: boolean
}

function severityColor(theme: BoxPlotTheme, severity?: DiffSeverity): string {
  if (severity === 'major') return theme.colors.mean
  if (severity === 'notable') return theme.colors.accent
  return theme.popover.text
}

export function CategoricalDiffSummary({
  summary, compareSummary, theme, label = 'Current', compareLabel = 'Comparison', fullscreen = false,
}: CategoricalDiffSummaryProps) {
  const t = theme.popover
  const f = theme.font
  const fx = fullscreen ? 1.3 : 1
  const diff = diffCategoricalSummary(summary, compareSummary)

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: f.labelSize * fx, letterSpacing: '0.05em', textTransform: 'uppercase',
    color: t.textMuted, marginBottom: 3,
  }

  const chipStyle: React.CSSProperties = {
    display: 'inline-block', padding: '2px 6px', borderRadius: 3, fontSize: f.labelSize * fx,
    marginRight: 4, marginBottom: 4, background: t.rule, color: t.text,
  }

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 8 }}>
        <span style={sectionLabelStyle}>Mode ({label} → {compareLabel})</span>
        <div style={{
          fontSize: 14 * fx, fontWeight: 600, marginTop: 2,
          color: diff.mode.changed ? severityColor(theme, 'major') : t.text,
        }}>
          {diff.mode.changed ? `"${diff.mode.a}" → "${diff.mode.b}"` : `Unchanged: "${diff.mode.a}"`}
          <span style={{ fontSize: 12 * fx, fontWeight: 400, color: t.textMuted, marginLeft: 8 }}>
            {Math.round(diff.mode.aProportion * 100)}% → {Math.round(diff.mode.bProportion * 100)}%
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 8, fontSize: 12 * fx, color: t.textMuted }}>
        Entropy: {diff.entropy.a.toFixed(2)} → {diff.entropy.b.toFixed(2)} bits{' '}
        <span style={{ color: severityColor(theme, diff.flags.find(fl => fl.field === 'entropy')?.severity) }}>
          ({diff.entropy.delta >= 0 ? '+' : ''}{diff.entropy.delta.toFixed(2)})
        </span>
      </div>

      {diff.newCategories.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={sectionLabelStyle}>New categories</div>
          {diff.newCategories.map(cat => (
            <span key={cat.label} style={chipStyle}>{cat.label} ({(cat.proportion * 100).toFixed(1)}%)</span>
          ))}
        </div>
      )}

      {diff.vanishedCategories.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={sectionLabelStyle}>Vanished categories</div>
          {diff.vanishedCategories.map(cat => (
            <span key={cat.label} style={chipStyle}>{cat.label} ({(cat.proportion * 100).toFixed(1)}%)</span>
          ))}
        </div>
      )}

      {diff.biggestShifts.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={sectionLabelStyle}>Biggest shifts</div>
          {diff.biggestShifts.map(shift => (
            <div key={shift.label} style={{ fontSize: 12 * fx, color: t.text, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span>{shift.label}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {(shift.proportionA * 100).toFixed(1)}% → {(shift.proportionB * 100).toFixed(1)}%{' '}
                <span style={{ color: Math.abs(shift.delta) > 0.1 ? theme.colors.mean : t.textMuted }}>
                  ({shift.delta >= 0 ? '+' : ''}{(shift.delta * 100).toFixed(1)}pt)
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {diff.caveat && (
        <div style={{ fontSize: 11 * fx, color: t.textMuted, marginTop: 6, fontStyle: 'italic' }}>
          {diff.caveat}
        </div>
      )}
    </div>
  )
}
