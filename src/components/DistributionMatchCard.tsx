import { DistributionMatch } from '../stats/distribution-match'
import type { BoxPlotTheme } from '../themes'

interface DistributionMatchCardProps {
  matches: DistributionMatch[]
  theme: BoxPlotTheme
}

const LOW_CONFIDENCE_THRESHOLD = 0.3

export function DistributionMatchCard({ matches, theme }: DistributionMatchCardProps) {
  if (matches.length === 0) return null

  const t = theme.popover
  const best = matches[0]
  const runners = matches.slice(1, 3).filter(m => m.similarity > 0.1)
  const isLowConfidence = best.similarity < LOW_CONFIDENCE_THRESHOLD

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 6 }}>
        <span style={{
          fontSize: theme.font.labelSize,
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
          color: t.textMuted,
        }}>
          {isLowConfidence ? 'Closest match (weak fit)' : 'Best match'}
        </span>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginTop: 2 }}>
          {best.name} distribution
          <span style={{ fontSize: 12, fontWeight: 400, color: t.textMuted, marginLeft: 8 }}>
            {Math.round(best.similarity * 100)}% similarity
          </span>
        </div>
        <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginTop: 4 }}>
          {best.explanation}
        </div>
        {isLowConfidence && (
          <div style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.4, marginTop: 4, fontStyle: 'italic' }}>
            No standard shape fits this data well - treat this as the least-bad option, not a confident classification.
          </div>
        )}
      </div>

      {runners.length > 0 && (
        <div style={{ fontSize: 11, color: t.textMuted, marginTop: 6 }}>
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
