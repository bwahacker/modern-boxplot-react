// ── Axis scale transforms ─────────────────────────────────────────────
// A scale maps a data value to a position on an abstract "scaled" number
// line (still needs an outer linear map onto pixels). `invert` is the
// inverse, used to map a pixel/drag position back to a data value.

export interface AxisScale {
  forward(v: number): number
  invert(v: number): number
}

export const linearScale: AxisScale = {
  forward: v => v,
  invert: v => v,
}

/**
 * Signed log ("symlog") scale: linear near zero, log-like beyond it, and
 * defined at zero and for negative values (unlike a plain log scale) -
 * needed for zero-inflated or mixed-sign data where log(0) would blow up.
 *
 * f(x) = sign(x) * log1p(|x| / linthresh)
 */
export function symlogScale(linthresh: number): AxisScale {
  const lt = Math.max(linthresh, 1e-9)
  return {
    forward: v => Math.sign(v) * Math.log1p(Math.abs(v) / lt),
    invert: v => Math.sign(v) * lt * (Math.exp(Math.abs(v)) - 1),
  }
}

/**
 * A reasonable default linear-region threshold for symlog: the smallest
 * nonzero magnitude present in the data (so real values stay in the
 * log-like region), falling back to a fraction of the value range when
 * the data has no nonzero values to anchor on (e.g. all zero).
 */
export function defaultLinthresh(data: number[], range: number): number {
  let min = Infinity
  for (const v of data) {
    const abs = Math.abs(v)
    if (abs > 0 && abs < min) min = abs
  }
  if (Number.isFinite(min)) return min
  return Math.max(range * 0.01, 1e-9)
}
