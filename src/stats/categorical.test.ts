import { describe, it, expect } from 'vitest'
import {
  categoricalSummary,
  bellCurveOrder,
  countFrequencies,
  categoricalNormalFit,
  isValueCounts,
} from './categorical'

describe('categoricalSummary', () => {
  it('computes totalCount, numCategories, mode, modeCount from a value_counts dict', () => {
    const summary = categoricalSummary({ A: 3, B: 7, C: 2 })
    expect(summary.totalCount).toBe(12)
    expect(summary.numCategories).toBe(3)
    expect(summary.mode).toBe('B')
    expect(summary.modeCount).toBe(7)
  })

  it('computes exact Shannon entropy for evenly split categories (log2(4) = 2 bits)', () => {
    const summary = categoricalSummary({ A: 25, B: 25, C: 25, D: 25 })
    expect(summary.entropy).toBeCloseTo(2, 10)
  })

  it('computes zero entropy for a single category', () => {
    const summary = categoricalSummary({ Only: 10 })
    expect(summary.entropy).toBeCloseTo(0, 10)
  })

  it('is not truncated when no true counts are supplied', () => {
    const summary = categoricalSummary({ A: 3, B: 7, C: 2 })
    expect(summary.isTruncated).toBe(false)
    expect(summary.trueTotalCount).toBeUndefined()
    expect(summary.trueUniqueCount).toBeUndefined()
  })

  // Regression test: a modal must never present the sum of a truncated
  // top-N category dict as if it were the whole column's N (see the
  // "N mislabeled as sum of top-25 categories" bug).
  it('flags truncation and surfaces the true total/unique counts when provided', () => {
    const summary = categoricalSummary(
      { A: 37, B: 42, C: 45 }, // a top-3 slice of a much larger column
      undefined,
      { totalCount: 1_469_403, uniqueCount: 182_004 },
    )
    expect(summary.totalCount).toBe(124) // sum of the shown slice, used for internal math
    expect(summary.trueTotalCount).toBe(1_469_403)
    expect(summary.trueUniqueCount).toBe(182_004)
    expect(summary.isTruncated).toBe(true)
  })

  it('does not flag truncation when the true counts equal the shown data', () => {
    const summary = categoricalSummary(
      { A: 3, B: 7, C: 2 },
      undefined,
      { totalCount: 12, uniqueCount: 3 },
    )
    expect(summary.isTruncated).toBe(false)
  })

  it('respects an explicit categoryOrder and appends unlisted categories', () => {
    const summary = categoricalSummary(
      { Low: 5, High: 20, Medium: 10 },
      ['Low', 'Medium', 'High'],
    )
    expect(summary.categories.map(c => c.label)).toEqual(['Low', 'Medium', 'High'])
  })

  it('handles an empty dict without throwing', () => {
    const summary = categoricalSummary({})
    expect(summary.totalCount).toBe(0)
    expect(summary.numCategories).toBe(0)
    expect(summary.modeCount).toBe(0)
    expect(summary.entropy).toBe(0)
    expect(summary.categories).toEqual([])
  })
})

describe('countFrequencies', () => {
  it('tallies raw string observations', () => {
    const counts = countFrequencies(['a', 'b', 'a', 'c', 'a', 'b'])
    expect(counts.get('a')).toBe(3)
    expect(counts.get('b')).toBe(2)
    expect(counts.get('c')).toBe(1)
  })
})

describe('bellCurveOrder', () => {
  it('places the highest-count category in the center', () => {
    const order = bellCurveOrder(new Map([['a', 5], ['b', 40], ['c', 10], ['d', 2]]))
    const mid = Math.floor(order.length / 2)
    expect(order[mid]).toBe('b')
  })

  it('handles zero and one category without throwing', () => {
    expect(bellCurveOrder(new Map())).toEqual([])
    expect(bellCurveOrder(new Map([['only', 1]]))).toEqual(['only'])
  })
})

describe('categoricalNormalFit', () => {
  it('scores a true symmetric bell profile higher than a monotonically decreasing one', () => {
    const bell = categoricalSummary({ a: 5, b: 20, c: 70, d: 20, e: 5 }, ['a', 'b', 'c', 'd', 'e'])
    const monotonic = categoricalSummary({ a: 100, b: 50, c: 25, d: 12, e: 6 }, ['a', 'b', 'c', 'd', 'e'])

    const bellFit = categoricalNormalFit(bell.categories)
    const monotonicFit = categoricalNormalFit(monotonic.categories)

    expect(bellFit.similarity).toBeGreaterThan(monotonicFit.similarity)
  })

  it('returns 0 similarity with too few categories to assess', () => {
    const summary = categoricalSummary({ a: 5, b: 10 })
    const fit = categoricalNormalFit(summary.categories)
    expect(fit.similarity).toBe(0)
  })
})

describe('isValueCounts', () => {
  it('recognizes a value_counts dict', () => {
    expect(isValueCounts({ a: 1, b: 2 })).toBe(true)
  })

  it('rejects raw string arrays and non-numeric dicts', () => {
    expect(isValueCounts(['a', 'b'])).toBe(false)
    expect(isValueCounts({ a: 'x' })).toBe(false)
  })
})
