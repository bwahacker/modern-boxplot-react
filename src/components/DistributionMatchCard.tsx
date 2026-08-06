import { DistributionMatch, LOW_CONFIDENCE_THRESHOLD } from '../stats/distribution-match'
import type { BoxPlotTheme } from '../themes'

interface DistributionMatchCardProps {
  matches: DistributionMatch[]
  theme: BoxPlotTheme
  /** Scales up typography for the popover's full-screen mode. */
  fullscreen?: boolean
}

export function DistributionMatchCard({ matches, theme, fullscreen = false }: DistributionMatchCardProps) {
  if (matches.length === 0) return null

  const t = theme.popover
  const best = matches[0]
  const runners = matches.slice(1, 3).filter(m => m.similarity > 0.1)
  const isLowConfidence = best.similarity < LOW_CONFIDENCE_THRESHOLD
  const fx = fullscreen ? 1.3 : 1

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{
          fontSize: theme.font.labelSize * fx,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          color: t.textMuted,
        }}>
          {isLowConfidence ? 'Closest match (weak fit)' : 'Best match'}
        </span>
        <div style={{ fontSize: 14 * fx, fontWeight: 600, color: t.text, marginTop: 2 }}>
          {best.name} distribution
          <span style={{ fontSize: 12 * fx, fontWeight: 400, color: t.textMuted, marginLeft: 8 }}>
            {Math.round(best.similarity * 100)}% similarity
          </span>
        </div>
        <div style={{ fontSize: 12 * fx, color: t.textMuted, lineHeight: 1.5, marginTop: 4 }}>
          {best.explanation}
        </div>
        {isLowConfidence && (
          <div style={{ fontSize: 11 * fx, color: t.textMuted, lineHeight: 1.4, marginTop: 4, fontStyle: 'italic' }}>
            No standard shape fits this data well - treat this as the least-bad option, not a confident classification.
          </div>
        )}
      </div>

      {runners.length > 0 && (
        <div style={{ fontSize: 11 * fx, color: t.textMuted, marginTop: 6 }}>
          Also resembles:{' '}
          {runners.map((r, i) => (
            <span key={r.name}>
              {r.name} ({Math.round(r.similarity * 100)}%)
              {i < runners.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
