/** Compact axis-tick formatting shared by Histogram's full axis and
 * BoxPlotSparkline's lightweight showAxis ticks, so both read identically. */
export function fmtAxis(n: number): string {
  if (Math.abs(n) >= 10000) return (n / 1000).toFixed(0) + 'k'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k'
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 10) return n.toFixed(1)
  if (Math.abs(n) >= 1) return n.toFixed(1)
  return n.toFixed(2)
}
