import { useRef, useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { BoxPlotTheme } from '../themes'
import type { CategoricalSummary } from '../stats/categorical'

interface NumericTooltipData {
  n: number
  min: number
  q1: number
  median: number
  q3: number
  max: number
  mean: number
  stddev: number
  iqr: number
  outlierCount: number
}

interface SparklineTooltipProps {
  anchorRef: React.RefObject<SVGSVGElement | null>
  theme: BoxPlotTheme
  numericData?: NumericTooltipData
  categoricalData?: CategoricalSummary
}

const TOOLTIP_WIDTH = 200

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  if (Math.abs(n) >= 1) return n.toFixed(2)
  return n.toFixed(3)
}

export function SparklineTooltip({ anchorRef, theme, numericData, categoricalData }: SparklineTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const t = theme.popover
  const [, setMeasured] = useState(false)

  // Re-measure after first render to get actual height
  useEffect(() => {
    if (tooltipRef.current) setMeasured(true)
  }, [])

  const getPosition = useCallback(() => {
    if (!anchorRef.current) return { top: 0, left: 0 }
    const rect = anchorRef.current.getBoundingClientRect()
    const gap = 6
    const margin = 8

    // Horizontal: center on anchor, clamp to viewport
    let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
    if (left < margin) left = margin
    if (left + TOOLTIP_WIDTH > window.innerWidth - margin) left = window.innerWidth - TOOLTIP_WIDTH - margin

    // Vertical: prefer above, fall back to below
    const tooltipH = tooltipRef.current?.offsetHeight ?? 100
    const spaceAbove = rect.top - gap
    let top: number

    if (spaceAbove >= tooltipH) {
      top = rect.top - gap - tooltipH
    } else {
      top = rect.bottom + gap
    }

    return { top, left }
  }, [anchorRef])

  const pos = getPosition()

  const cellStyle: React.CSSProperties = {
    padding: '1px 0',
    fontSize: 10,
    fontFamily: theme.font.family,
    lineHeight: 1.4,
  }

  const labelStyle: React.CSSProperties = {
    ...cellStyle,
    color: t.textMuted,
    textAlign: 'right',
    paddingRight: 6,
  }

  const valueStyle: React.CSSProperties = {
    ...cellStyle,
    color: t.text,
    fontVariantNumeric: 'tabular-nums',
  }

  return createPortal(
    <div
      ref={tooltipRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: TOOLTIP_WIDTH,
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 4,
        padding: '8px 10px',
        zIndex: 9997,
        fontFamily: theme.font.family,
        boxShadow: t.shadow,
        pointerEvents: 'none',
        animation: 'popover-in 0.1s ease-out',
      }}
    >
      {numericData && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={labelStyle}>n</td>
              <td style={valueStyle}>{numericData.n.toLocaleString()}</td>
              <td style={{ ...labelStyle, paddingLeft: 8 }}>mean</td>
              <td style={valueStyle}>{fmt(numericData.mean)}</td>
            </tr>
            <tr>
              <td style={labelStyle}>min</td>
              <td style={valueStyle}>{fmt(numericData.min)}</td>
              <td style={{ ...labelStyle, paddingLeft: 8 }}>std</td>
              <td style={valueStyle}>{fmt(numericData.stddev)}</td>
            </tr>
            <tr>
              <td style={labelStyle}>Q1</td>
              <td style={valueStyle}>{fmt(numericData.q1)}</td>
              <td style={{ ...labelStyle, paddingLeft: 8 }}>IQR</td>
              <td style={valueStyle}>{fmt(numericData.iqr)}</td>
            </tr>
            <tr>
              <td style={labelStyle}>med</td>
              <td style={valueStyle}>{fmt(numericData.median)}</td>
              {numericData.outlierCount > 0 ? (
                <>
                  <td style={{ ...labelStyle, paddingLeft: 8 }}>outliers</td>
                  <td style={valueStyle}>{numericData.outlierCount}</td>
                </>
              ) : (
                <><td /><td /></>
              )}
            </tr>
            <tr>
              <td style={labelStyle}>Q3</td>
              <td style={valueStyle}>{fmt(numericData.q3)}</td>
              <td /><td />
            </tr>
            <tr>
              <td style={labelStyle}>max</td>
              <td style={valueStyle}>{fmt(numericData.max)}</td>
              <td /><td />
            </tr>
          </tbody>
        </table>
      )}

      {categoricalData && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={labelStyle}>n</td>
              <td style={valueStyle}>{(categoricalData.trueTotalCount ?? categoricalData.totalCount).toLocaleString()}</td>
            </tr>
            <tr>
              <td style={labelStyle}>mode</td>
              <td style={valueStyle}>{categoricalData.mode} ({categoricalData.modeCount})</td>
            </tr>
            <tr>
              <td style={labelStyle}>categories</td>
              <td style={valueStyle}>{(categoricalData.trueUniqueCount ?? categoricalData.numCategories).toLocaleString()}</td>
            </tr>
            <tr>
              <td style={labelStyle}>{categoricalData.isTruncated ? `entropy (top ${categoricalData.numCategories})` : 'entropy'}</td>
              <td style={valueStyle}>{categoricalData.entropy.toFixed(2)} bits</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>,
    document.body,
  )
}
