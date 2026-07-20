import { describe, it, expect } from 'vitest'
import { matchDistributions } from './distribution-match'

// Deterministic seeded RNG so these tests are reproducible.
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

function generateUniform(n: number, a: number, b: number, seed: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => a + (b - a) * rand())
}

function generateNormal(n: number, mu: number, sigma: number, seed: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => mu + sigma * boxMuller(rand))
}

function generateLogNormal(n: number, mu: number, sigma: number, seed: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => Math.exp(mu + sigma * boxMuller(rand)))
}

function generateExponential(n: number, lambda: number, seed: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => -Math.log(rand() || 0.0001) / lambda)
}

function generateBimodal(n: number, seed: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => {
    if (rand() < 0.45) return 25 + 6 * boxMuller(rand)
    return 65 + 8 * boxMuller(rand)
  })
}

function topMatch(data: number[]) {
  return matchDistributions(data)[0].name
}

describe('matchDistributions - regression: uniform vs bimodal', () => {
  // Splitting any unimodal/uniform sample at its median and fitting a normal
  // to each half always yields two different means - that alone used to be
  // (mis-)treated as evidence of bimodality, so genuinely uniform data was
  // routinely misclassified as "Bimodal". See the bimodal-shape-detection fix.
  const seeds = [1, 42, 99, 137, 256, 314, 500, 777]

  it.each(seeds)('recognizes a uniform sample (n=400, seed=%i) as Uniform', seed => {
    const data = generateUniform(400, 18, 82, seed)
    expect(topMatch(data)).toBe('Uniform')
  })

  it.each(seeds)('still recognizes a genuinely bimodal sample (seed=%i) as Bimodal', seed => {
    const data = generateBimodal(250, seed)
    expect(topMatch(data)).toBe('Bimodal')
  })
})

describe('matchDistributions - other known shapes', () => {
  it('recognizes a normal sample as Normal', () => {
    const data = generateNormal(500, 50, 10, 99)
    expect(topMatch(data)).toBe('Normal')
  })

  it('recognizes a log-normal sample as Log-Normal', () => {
    const data = generateLogNormal(500, 5.2, 0.7, 1)
    expect(topMatch(data)).toBe('Log-Normal')
  })

  it('recognizes an exponential sample as Exponential', () => {
    const data = generateExponential(500, 0.15, 1)
    expect(topMatch(data)).toBe('Exponential')
  })
})

describe('matchDistributions - edge cases', () => {
  it('returns an "Insufficient data" placeholder below 4 points', () => {
    const matches = matchDistributions([1, 2, 3])
    expect(matches).toHaveLength(1)
    expect(matches[0].name).toBe('Insufficient data')
  })

  it('does not throw and excludes degenerate candidates for all-identical values', () => {
    const matches = matchDistributions([5, 5, 5, 5, 5, 5, 5, 5])
    for (const m of matches) {
      expect(Number.isFinite(m.similarity)).toBe(true)
    }
  })

  it('sorts candidates by similarity descending', () => {
    const data = generateNormal(300, 0, 1, 7)
    const matches = matchDistributions(data)
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].similarity).toBeGreaterThanOrEqual(matches[i].similarity)
    }
  })
})
