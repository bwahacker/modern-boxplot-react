import { useMemo } from 'react'
import { categoricalNormalFit } from '../stats/categorical'
import type { CategoricalSummary } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface CategoricalMatchCardProps {
  summary: CategoricalSummary
  theme: BoxPlotTheme
}

export function CategoricalMatchCard({ summary, theme }: CategoricalMatchCardProps) {
  const t = theme.popover

  const fit = useMemo(
    () => categoricalNormalFit(summary.categories),
    [summary.categories],
  )

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{
          fontSize: theme.font.labelSize,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          color: t.textMuted,
        }}>
          Bell-curve fit
        </span>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginTop: 2 }}>
          {Math.round(fit.similarity * 100)}% similarity
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginTop: 4 }}>
          {fit.explanation}
        </div>
      </div>
    </div>
  )
}
