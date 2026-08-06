import { describe, it, expect } from 'vitest'
import {
  diffDescriptiveStats,
  diffDistributionMatch,
  diffCategoricalSummary,
} from './diff'
import type { DescriptiveStats } from './descriptive'
import { matchDistributions } from './distribution-match'
import { categoricalSummary } from './categorical'

// Deterministic seeded RNG, matching the convention already used in
// distribution-match.test.ts.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function boxMuller(rand: () => number): number {
  const u1 = rand()
  const u2 = rand()
  return Math.sqrt(-2 * Math.log(u1 || 0.0001)) * Math.cos(2 * Math.PI * u2)
}

function generateNormal(n: number, mu: number, sigma: number, seed: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => mu + sigma * boxMuller(rand))
}

function generateLogNormal(n: number, mu: number, sigma: number, seed: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => Math.exp(mu + sigma * boxMuller(rand)))
}

function makeStats(overrides: Partial<DescriptiveStats>): DescriptiveStats {
  return {
    min: 0, q1: 25, median: 50, q3: 75, max: 100,
    mean: 50, stddev: 20, variance: 400, skewness: 0, kurtosis: 0, n: 100, iqr: 50,
    ...overrides,
  }
}

describe('diffDescriptiveStats - deltas', () => {
  it('computes exact delta/deltaPct for each field', () => {
    const a = makeStats({ n: 100, mean: 50 })
    const b = makeStats({ n: 120, mean: 60 })
    const diff = diffDescriptiveStats(a, b)
    expect(diff.n).toEqual({ a: 100, b: 120, delta: 20, deltaPct: 0.2 })
    expect(diff.mean).toEqual({ a: 50, b: 60, delta: 10, deltaPct: 0.2 })
  })

  it('reports deltaPct as null when the baseline value is zero', () => {
    const a = makeStats({ min: 0 })
    const b = makeStats({ min: 5 })
    expect(diffDescriptiveStats(a, b).min.deltaPct).toBeNull()
  })
})

describe('diffDescriptiveStats - mean shift severity', () => {
  // pooled stddev = 20 when both sides have stddev 20, so sigma = delta / 20
  it('does not flag a ~0.1 sigma shift', () => {
    const a = makeStats({ mean: 50, stddev: 20 })
    const b = makeStats({ mean: 52, stddev: 20 })
    expect(diffDescriptiveStats(a, b).flags.some(f => f.field === 'mean')).toBe(false)
  })

  it('flags a ~0.3 sigma shift as notable', () => {
    const a = makeStats({ mean: 50, stddev: 20 })
    const b = makeStats({ mean: 56, stddev: 20 })
    const flag = diffDescriptiveStats(a, b).flags.find(f => f.field === 'mean')
    expect(flag?.severity).toBe('notable')
  })

  it('flags a ~0.6 sigma shift as major', () => {
    const a = makeStats({ mean: 50, stddev: 20 })
    const b = makeStats({ mean: 62, stddev: 20 })
    const flag = diffDescriptiveStats(a, b).flags.find(f => f.field === 'mean')
    expect(flag?.severity).toBe('major')
  })
})

describe('diffDescriptiveStats - stddev ratio severity', () => {
  it('does not flag a ratio within [0.8, 1.25]', () => {
    const a = makeStats({ stddev: 20 })
    const b = makeStats({ stddev: 22 }) // ratio 1.1
    expect(diffDescriptiveStats(a, b).flags.some(f => f.field === 'stddev')).toBe(false)
  })

  it('flags a ratio of 1.3 as notable', () => {
    const a = makeStats({ stddev: 20 })
    const b = makeStats({ stddev: 26 }) // ratio 1.3
    const flag = diffDescriptiveStats(a, b).flags.find(f => f.field === 'stddev')
    expect(flag?.severity).toBe('notable')
  })

  it('flags a ratio of 2.5 as major', () => {
    const a = makeStats({ stddev: 20 })
    const b = makeStats({ stddev: 50 }) // ratio 2.5
    const flag = diffDescriptiveStats(a, b).flags.find(f => f.field === 'stddev')
    expect(flag?.severity).toBe('major')
  })

  it('flags a ratio of 0.4 (shrunk spread) as major', () => {
    const a = makeStats({ stddev: 20 })
    const b = makeStats({ stddev: 8 }) // ratio 0.4
    const flag = diffDescriptiveStats(a, b).flags.find(f => f.field === 'stddev')
    expect(flag?.severity).toBe('major')
  })
})

describe('diffDescriptiveStats - N change severity', () => {
  it('does not flag a 5% change', () => {
    const a = makeStats({ n: 100 })
    const b = makeStats({ n: 105 })
    expect(diffDescriptiveStats(a, b).flags.some(f => f.field === 'n')).toBe(false)
  })

  it('flags a 15% change as notable', () => {
    const a = makeStats({ n: 100 })
    const b = makeStats({ n: 115 })
    const flag = diffDescriptiveStats(a, b).flags.find(f => f.field === 'n')
    expect(flag?.severity).toBe('notable')
  })

  it('flags a 40% change as major', () => {
    const a = makeStats({ n: 100 })
    const b = makeStats({ n: 140 })
    const flag = diffDescriptiveStats(a, b).flags.find(f => f.field === 'n')
    expect(flag?.severity).toBe('major')
  })
})

describe('diffDescriptiveStats - rangeShift', () => {
  const a = makeStats({ min: 0, max: 100 })

  it('reports "unchanged" when bounds barely move', () => {
    const b = makeStats({ min: 0.2, max: 99.8 })
    expect(diffDescriptiveStats(a, b).rangeShift.direction).toBe('unchanged')
  })

  it('reports "expanded" when both bounds move outward', () => {
    const b = makeStats({ min: -10, max: 110 })
    expect(diffDescriptiveStats(a, b).rangeShift.direction).toBe('expanded')
  })

  it('reports "contracted" when both bounds move inward', () => {
    const b = makeStats({ min: 10, max: 90 })
    expect(diffDescriptiveStats(a, b).rangeShift.direction).toBe('contracted')
  })

  it('reports "shifted-up" when both bounds move up together', () => {
    const b = makeStats({ min: 20, max: 120 })
    expect(diffDescriptiveStats(a, b).rangeShift.direction).toBe('shifted-up')
  })

  it('reports "shifted-down" when both bounds move down together', () => {
    const b = makeStats({ min: -20, max: 80 })
    expect(diffDescriptiveStats(a, b).rangeShift.direction).toBe('shifted-down')
  })
})

describe('diffDistributionMatch', () => {
  // The concrete "did the shape actually change" regression case.
  it('detects a real shape change (Log-Normal -> Zero-inflated)', () => {
    const matchesA = matchDistributions(generateLogNormal(500, 5.2, 0.7, 1))
    const matchesB = matchDistributions([...Array(99).fill(0), 1_000_000, 5_000_000])
    const diff = diffDistributionMatch(matchesA, matchesB)
    expect(diff.from).toBe('Log-Normal')
    expect(diff.to).toBe('Zero-inflated')
    expect(diff.changed).toBe(true)
    expect(diff.flags.some(f => f.field === 'shape')).toBe(true)
  })

  // Anti-noise: two independent samples of the *same* underlying distribution
  // must not be reported as a shape change just because of sampling noise -
  // this is exactly what the severity thresholds exist to prevent.
  it('does not flag a shape change between two samples of the same distribution', () => {
    const matchesA = matchDistributions(generateNormal(400, 45, 12, 1))
    const matchesB = matchDistributions(generateNormal(400, 45, 12, 2))
    const diff = diffDistributionMatch(matchesA, matchesB)
    expect(diff.from).toBe('Normal')
    expect(diff.to).toBe('Normal')
    expect(diff.changed).toBe(false)
    expect(diff.flags).toHaveLength(0)
  })

  it('flags a low-confidence change when either side is already a weak fit', () => {
    const weakA = [{ name: 'Normal', similarity: 0.05, explanation: '', params: {} }]
    const weakB = [{ name: 'Uniform', similarity: 0.9, explanation: '', params: {} }]
    const diff = diffDistributionMatch(weakA, weakB)
    expect(diff.changed).toBe(true)
    expect(diff.isLowConfidence).toBe(true)
  })
})

describe('diffCategoricalSummary', () => {
  it('detects new and vanished categories, and computes biggest proportion shifts', () => {
    // a = current snapshot, b = comparison/baseline snapshot.
    const a = categoricalSummary({ Cat: 5, Dog: 3, Fish: 2 })
    const b = categoricalSummary({ Cat: 5, Dog: 2, Bird: 4 })
    const diff = diffCategoricalSummary(a, b)

    expect(diff.newCategories.map(c => c.label)).toEqual(['Fish']) // in current (a), not in baseline (b)
    expect(diff.vanishedCategories.map(c => c.label)).toEqual(['Bird']) // in baseline (b), not in current (a)
    expect(diff.biggestShifts[0].label).toBe('Dog') // biggest |delta| among categories in both
    expect(diff.flags.some(f => f.field === 'categories')).toBe(true)
  })

  it('flags a mode change with both proportions', () => {
    const a = categoricalSummary({ Low: 20, High: 5 })
    const b = categoricalSummary({ Low: 5, High: 20 })
    const diff = diffCategoricalSummary(a, b)

    expect(diff.mode).toEqual({ a: 'Low', b: 'High', changed: true, aProportion: 20 / 25, bProportion: 20 / 25 })
    expect(diff.flags.some(f => f.field === 'mode' && f.severity === 'major')).toBe(true)
  })

  it('does not flag a mode change when the mode is the same', () => {
    const a = categoricalSummary({ Cat: 5, Dog: 3 })
    const b = categoricalSummary({ Cat: 6, Dog: 3 })
    expect(diffCategoricalSummary(a, b).mode.changed).toBe(false)
  })

  it('flags a large entropy change', () => {
    const a = categoricalSummary({ A: 25, B: 25, C: 25, D: 25 }) // entropy = 2 bits (even split)
    const b = categoricalSummary({ A: 97, B: 1, C: 1, D: 1 }) // heavily skewed, low entropy
    const diff = diffCategoricalSummary(a, b)
    expect(Math.abs(diff.entropy.delta)).toBeGreaterThan(0.75)
    expect(diff.flags.some(f => f.field === 'entropy' && f.severity === 'major')).toBe(true)
  })

  it('sets a truncation caveat when either snapshot is truncated, and omits it otherwise', () => {
    const a = categoricalSummary({ Cat: 5, Dog: 3 })
    const truncatedB = categoricalSummary({ Cat: 5, Dog: 3 }, undefined, { totalCount: 1000, uniqueCount: 50 })
    expect(diffCategoricalSummary(a, truncatedB).caveat).toBeDefined()

    const b = categoricalSummary({ Cat: 5, Dog: 3 })
    expect(diffCategoricalSummary(a, b).caveat).toBeUndefined()
  })
})
