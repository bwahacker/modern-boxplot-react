import { mean as calcMean, stddev as calcStddev, skewness as calcSkewness, kurtosis as calcKurtosis } from './descriptive'
import { kernelDensity } from './histogram'

export interface DistributionMatch {
  name: string
  similarity: number
  explanation: string
  params: Record<string, number>
}

// ── CDF functions for each candidate distribution ──────────────────────

/** Standard normal CDF approximation (Abramowitz & Stegun) */
function normalCDF(x: number, mu: number, sigma: number): number {
  const z = (x - mu) / sigma
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989422804014327 // 1/sqrt(2π)
  const p =
    d *
    Math.exp((-z * z) / 2) *
    (t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))))
  return z > 0 ? 1 - p : p
}

function logNormalCDF(x: number, mu: number, sigma: number): number {
  if (x <= 0) return 0
  return normalCDF(Math.log(x), mu, sigma)
}

function exponentialCDF(x: number, lambda: number): number {
  if (x < 0) return 0
  return 1 - Math.exp(-lambda * x)
}

function uniformCDF(x: number, a: number, b: number): number {
  if (x <= a) return 0
  if (x >= b) return 1
  return (x - a) / (b - a)
}

/** Mixture of two normals CDF */
function bimodalCDF(
  x: number,
  mu1: number,
  sigma1: number,
  mu2: number,
  sigma2: number,
  weight: number
): number {
  return weight * normalCDF(x, mu1, sigma1) + (1 - weight) * normalCDF(x, mu2, sigma2)
}

// ── KS statistic ───────────────────────────────────────────────────────

/** Kolmogorov-Smirnov statistic: max |empirical CDF - theoretical CDF| */
function ksStatistic(sortedData: number[], theoreticalCDF: (x: number) => number): number {
  const n = sortedData.length
  let maxDiff = 0

  for (let i = 0; i < n; i++) {
    const empirical = (i + 1) / n
    const empiricalPrev = i / n
    const theoretical = theoreticalCDF(sortedData[i])
    maxDiff = Math.max(maxDiff, Math.abs(empirical - theoretical), Math.abs(empiricalPrev - theoretical))
  }

  return maxDiff
}

/** Convert KS distance to a 0–1 similarity score */
function ksToSimilarity(ks: number): number {
  // KS ranges from 0 (perfect fit) to 1 (worst).
  // Use a nonlinear mapping so that small KS values
  // produce high similarity and it drops off quickly.
  return Math.max(0, Math.min(1, 1 - 1.8 * ks))
}

// ── Explanation templates ──────────────────────────────────────────────

function fmt(n: number): string {
  return Math.abs(n) < 0.01 ? n.toExponential(1) : n.toFixed(2)
}

function normalExplanation(sk: number, ku: number): string {
  return `Symmetric bell-shaped spread. Skewness ${fmt(sk)}, kurtosis ${fmt(ku)} (near 0 for normal).`
}

function logNormalExplanation(sk: number): string {
  return `Right-skewed with a long tail of large values (skewness ${fmt(sk)}). Log-transformed data is approximately symmetric.`
}

function exponentialExplanation(lambda: number): string {
  return `Strongly right-skewed. Most values clustered near zero, with rare large values. Rate \u03BB \u2248 ${fmt(lambda)}.`
}

function uniformExplanation(a: number, b: number): string {
  return `Values spread roughly evenly from ${fmt(a)} to ${fmt(b)} with little central tendency.`
}

function bimodalExplanation(mu1: number, mu2: number): string {
  return `Two distinct clusters of values, centered near ${fmt(mu1)} and ${fmt(mu2)}.`
}

// ── Bimodal shape detection ─────────────────────────────────────────────
// Splitting any unimodal (or uniform) sample at its median and fitting a
// normal to each half will always yield two different means — that alone
// is not evidence of bimodality. Instead, look for a genuine antimode: a
// KDE valley between two peaks that dips well below both, which a merely
// unimodal or uniform distribution won't produce.

interface BimodalSplit {
  mu1: number
  sigma1: number
  mu2: number
  sigma2: number
  weight: number
}

function detectBimodalSplit(data: number[], overallStddev: number): BimodalSplit | null {
  const kde = kernelDensity(data, 100)
  if (kde.length < 5) return null

  const peaks: number[] = []
  const valleys: number[] = []
  for (let i = 1; i < kde.length - 1; i++) {
    const { y: yPrev } = kde[i - 1]
    const { y } = kde[i]
    const { y: yNext } = kde[i + 1]
    if (y > yPrev && y > yNext) peaks.push(i)
    if (y < yPrev && y < yNext) valleys.push(i)
  }
  if (peaks.length < 2) return null

  // Consider the two tallest peaks, in x-order
  const tallest = [...peaks].sort((a, b) => kde[b].y - kde[a].y).slice(0, 2).sort((a, b) => a - b)
  const [iLeft, iRight] = tallest

  // Deepest valley strictly between them
  const between = valleys.filter(v => v > iLeft && v < iRight)
  if (between.length === 0) return null
  const iValley = between.reduce((min, v) => (kde[v].y < kde[min].y ? v : min), between[0])

  const peakHeight = Math.min(kde[iLeft].y, kde[iRight].y)
  const valleyHeight = kde[iValley].y
  if (peakHeight <= 0 || valleyHeight / peakHeight > 0.65) return null

  const splitX = kde[iValley].x
  const lower = data.filter(x => x <= splitX)
  const upper = data.filter(x => x > splitX)
  if (lower.length < 2 || upper.length < 2) return null

  const mu1 = calcMean(lower)
  const mu2 = calcMean(upper)
  if (Math.abs(mu2 - mu1) / overallStddev <= 0.5) return null

  return {
    mu1,
    sigma1: Math.max(calcStddev(lower), overallStddev * 0.1),
    mu2,
    sigma2: Math.max(calcStddev(upper), overallStddev * 0.1),
    weight: lower.length / data.length,
  }
}

// ── Main matching function ─────────────────────────────────────────────

export function matchDistributions(data: number[]): DistributionMatch[] {
  if (data.length < 4) {
    return [{ name: 'Insufficient data', similarity: 0, explanation: 'Need at least 4 data points to match distributions.', params: {} }]
  }

  const sorted = [...data].sort((a, b) => a - b)
  const m = calcMean(data)
  const s = calcStddev(data)
  const sk = calcSkewness(data)
  const ku = calcKurtosis(data)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  const candidates: DistributionMatch[] = []

  // Normal
  if (s > 0) {
    const ks = ksStatistic(sorted, x => normalCDF(x, m, s))
    candidates.push({
      name: 'Normal',
      similarity: ksToSimilarity(ks),
      explanation: normalExplanation(sk, ku),
      params: { '\u03BC': m, '\u03C3': s },
    })
  }

  // Log-Normal (only if all values > 0)
  const allPositive = sorted[0] > 0
  if (allPositive) {
    const logData = data.map(x => Math.log(x))
    const logMu = calcMean(logData)
    const logSigma = calcStddev(logData)
    if (logSigma > 0) {
      const ks = ksStatistic(sorted, x => logNormalCDF(x, logMu, logSigma))
      candidates.push({
        name: 'Log-Normal',
        similarity: ksToSimilarity(ks),
        explanation: logNormalExplanation(sk),
        params: { '\u03BC_log': logMu, '\u03C3_log': logSigma },
      })
    }
  }

  // Exponential (only if all values >= 0)
  const allNonNeg = sorted[0] >= 0
  if (allNonNeg && m > 0) {
    const lambda = 1 / m
    const ks = ksStatistic(sorted, x => exponentialCDF(x, lambda))
    candidates.push({
      name: 'Exponential',
      similarity: ksToSimilarity(ks),
      explanation: exponentialExplanation(lambda),
      params: { '\u03BB': lambda },
    })
  }

  // Uniform
  if (max > min) {
    const ks = ksStatistic(sorted, x => uniformCDF(x, min, max))
    candidates.push({
      name: 'Uniform',
      similarity: ksToSimilarity(ks),
      explanation: uniformExplanation(min, max),
      params: { a: min, b: max },
    })
  }

  // Bimodal (mixture of two normals) - only when the KDE shows a genuine
  // antimode (valley between two peaks), not just a median split.
  if (data.length >= 8 && s > 0) {
    const split = detectBimodalSplit(data, s)
    if (split) {
      const { mu1, sigma1, mu2, sigma2, weight } = split
      const ks = ksStatistic(sorted, x => bimodalCDF(x, mu1, sigma1, mu2, sigma2, weight))
      candidates.push({
        name: 'Bimodal',
        similarity: ksToSimilarity(ks),
        explanation: bimodalExplanation(mu1, mu2),
        params: { '\u03BC\u2081': mu1, '\u03C3\u2081': sigma1, '\u03BC\u2082': mu2, '\u03C3\u2082': sigma2 },
      })
    }
  }

  // Sort by similarity descending
  candidates.sort((a, b) => b.similarity - a.similarity)

  return candidates
}
