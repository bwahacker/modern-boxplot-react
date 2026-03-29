export interface FiveNumberSummary {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export interface DescriptiveStats extends FiveNumberSummary {
  mean: number
  stddev: number
  variance: number
  skewness: number
  kurtosis: number
  n: number
  iqr: number
}

/** Sort-safe copy */
function sorted(data: number[]): number[] {
  return [...data].sort((a, b) => a - b)
}

/** Linear interpolation quantile (matches Excel PERCENTILE.INC / NumPy default) */
function quantile(sortedData: number[], p: number): number {
  const n = sortedData.length
  if (n === 0) return NaN
  if (n === 1) return sortedData[0]
  const index = p * (n - 1)
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  const frac = index - lo
  return sortedData[lo] * (1 - frac) + sortedData[hi] * frac
}

export function fiveNumberSummary(data: number[]): FiveNumberSummary {
  const s = sorted(data)
  return {
    min: s[0],
    q1: quantile(s, 0.25),
    median: quantile(s, 0.5),
    q3: quantile(s, 0.75),
    max: s[s.length - 1],
  }
}

export function mean(data: number[]): number {
  if (data.length === 0) return NaN
  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  return sum / data.length
}

export function variance(data: number[]): number {
  if (data.length < 2) return 0
  const m = mean(data)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    const d = data[i] - m
    sum += d * d
  }
  return sum / (data.length - 1) // Bessel's correction
}

export function stddev(data: number[]): number {
  return Math.sqrt(variance(data))
}

/** Fisher's moment coefficient of skewness */
export function skewness(data: number[]): number {
  const n = data.length
  if (n < 3) return 0
  const m = mean(data)
  const s = stddev(data)
  if (s === 0) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += Math.pow((data[i] - m) / s, 3)
  }
  return (n / ((n - 1) * (n - 2))) * sum
}

/** Excess kurtosis (normal distribution = 0) */
export function kurtosis(data: number[]): number {
  const n = data.length
  if (n < 4) return 0
  const m = mean(data)
  const s = stddev(data)
  if (s === 0) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += Math.pow((data[i] - m) / s, 4)
  }
  const raw = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * sum
  const correction = (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3))
  return raw - correction
}

/** Find outliers beyond 1.5 × IQR */
export function outliers(data: number[]): number[] {
  const { q1, q3 } = fiveNumberSummary(data)
  const iqr = q3 - q1
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr
  return data.filter(x => x < lower || x > upper)
}

/** Whisker bounds (min/max excluding outliers) */
export function whiskerBounds(data: number[]): { lower: number; upper: number } {
  const { q1, q3 } = fiveNumberSummary(data)
  const iqr = q3 - q1
  const lowerFence = q1 - 1.5 * iqr
  const upperFence = q3 + 1.5 * iqr
  const s = sorted(data)
  const lower = s.find(x => x >= lowerFence) ?? s[0]
  const upper = [...s].reverse().find(x => x <= upperFence) ?? s[s.length - 1]
  return { lower, upper }
}

/** Compute all descriptive statistics at once */
export function descriptiveStats(data: number[]): DescriptiveStats {
  const fns = fiveNumberSummary(data)
  return {
    ...fns,
    mean: mean(data),
    stddev: stddev(data),
    variance: variance(data),
    skewness: skewness(data),
    kurtosis: kurtosis(data),
    n: data.length,
    iqr: fns.q3 - fns.q1,
  }
}

/** Filter out NaN and Infinity values */
export function cleanData(data: number[]): number[] {
  return data.filter(x => Number.isFinite(x))
}
