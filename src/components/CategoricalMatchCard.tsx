import { useMemo } from 'react'
import { categoricalNormalFit } from '../stats/categorical'
import type { CategoricalSummary } from '../stats/categorical'
import type { BoxPlotTheme } from '../themes'

interface CategoricalMatchCardProps {
  summary: CategoricalSummary
  theme: BoxPlotTheme
  /** Scales up typography for the popover's full-screen mode. */
  fullscreen?: boolean
}

export function CategoricalMatchCard({ summary, theme, fullscreen = false }: CategoricalMatchCardProps) {
  const t = theme.popover
  const fx = fullscreen ? 1.3 : 1

  const fit = useMemo(
    () => categoricalNormalFit(summary.categories),
    [summary.categories],
  )

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{
          fontSize: theme.font.labelSize * fx,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          color: t.textMuted,
        }}>
          {summary.isTruncated ? `Bell-curve fit (top ${summary.numCategories})` : 'Bell-curve fit'}
        </span>
        <div style={{ fontSize: 14 * fx, fontWeight: 600, color: t.text, marginTop: 2 }}>
          {Math.round(fit.similarity * 100)}% similarity
        </div>
        <div style={{ fontSize: 12 * fx, color: t.textMuted, lineHeight: 1.5, marginTop: 4 }}>
          {fit.explanation}
          {summary.isTruncated && ' Computed from the categories shown only, not the full column.'}
        </div>
      </div>
    </div>
  )
}
