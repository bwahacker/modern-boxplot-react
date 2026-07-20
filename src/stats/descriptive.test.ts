import { describe, it, expect } from 'vitest'
import {
  fiveNumberSummary,
  mean,
  variance,
  stddev,
  skewness,
  kurtosis,
  outliers,
  whiskerBounds,
  descriptiveStats,
  cleanData,
} from './descriptive'

describe('fiveNumberSummary', () => {
  it('matches linear-interpolation quantiles (NumPy default) for 1..10', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const fns = fiveNumberSummary(data)
    expect(fns.min).toBe(1)
    expect(fns.max).toBe(10)
    expect(fns.median).toBeCloseTo(5.5, 10)
    expect(fns.q1).toBeCloseTo(3.25, 10)
    expect(fns.q3).toBeCloseTo(7.75, 10)
  })

  it('does not require pre-sorted input', () => {
    const shuffled = [5, 1, 9, 3, 7, 2, 8, 4, 6, 10]
    expect(fiveNumberSummary(shuffled)).toEqual(fiveNumberSummary([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  })
})

describe('mean / variance / stddev', () => {
  const data = [2, 4, 4, 4, 5, 5, 7, 9]

  it('computes the mean', () => {
    expect(mean(data)).toBeCloseTo(5, 10)
  })

  it('computes sample variance with Bessel correction', () => {
    // sum((x-5)^2) = 9+1+1+1+0+0+4+16 = 32; 32/(8-1) = 4.571428...
    expect(variance(data)).toBeCloseTo(32 / 7, 10)
  })

  it('computes stddev as sqrt(variance)', () => {
    expect(stddev(data)).toBeCloseTo(Math.sqrt(32 / 7), 10)
  })

  it('returns NaN mean and 0 variance for an empty array', () => {
    expect(mean([])).toBeNaN()
    expect(variance([])).toBe(0)
  })

  it('returns 0 variance for a single-element array', () => {
    expect(variance([42])).toBe(0)
    expect(stddev([42])).toBe(0)
  })
})

describe('skewness / kurtosis', () => {
  it('is ~0 for symmetric data', () => {
    const symmetric = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(skewness(symmetric)).toBeCloseTo(0, 5)
  })

  it('is positive for right-skewed data', () => {
    const rightSkewed = [1, 1, 1, 1, 2, 2, 3, 10, 20, 50]
    expect(skewness(rightSkewed)).toBeGreaterThan(0)
  })

  it('is negative for left-skewed data', () => {
    const leftSkewed = [-50, -20, -10, 3, 2, 2, 1, 1, 1, 1]
    expect(skewness(leftSkewed)).toBeLessThan(0)
  })

  it('returns 0 below the minimum sample size (skewness n<3, kurtosis n<4)', () => {
    expect(skewness([1, 2])).toBe(0)
    expect(kurtosis([1, 2, 3])).toBe(0)
  })

  it('returns 0 when stddev is 0 (all identical values)', () => {
    expect(skewness([5, 5, 5, 5])).toBe(0)
    expect(kurtosis([5, 5, 5, 5, 5])).toBe(0)
  })
})

describe('outliers / whiskerBounds', () => {
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]

  it('flags a planted extreme value as an outlier', () => {
    expect(outliers(data)).toEqual([100])
  })

  it('excludes outliers from the whisker bounds', () => {
    const { lower, upper } = whiskerBounds(data)
    expect(lower).toBe(1)
    expect(upper).toBe(9)
  })

  it('finds no outliers in a tight, evenly spread dataset', () => {
    expect(outliers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([])
  })
})

describe('descriptiveStats', () => {
  it('bundles five-number summary with mean/stddev/skew/kurtosis/n/iqr', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const stats = descriptiveStats(data)
    expect(stats.n).toBe(10)
    expect(stats.iqr).toBeCloseTo(stats.q3 - stats.q1, 10)
    expect(stats.mean).toBeCloseTo(mean(data), 10)
  })
})

describe('cleanData', () => {
  it('drops NaN and Infinity, keeps finite numbers', () => {
    expect(cleanData([1, NaN, 2, Infinity, -Infinity, 3])).toEqual([1, 2, 3])
  })
})
