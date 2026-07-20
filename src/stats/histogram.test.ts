import { describe, it, expect } from 'vitest'
import { binData, kernelDensity } from './histogram'

describe('binData', () => {
  it('distributes all values into bins whose counts sum to the input length', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    const bins = binData(data)
    expect(bins.reduce((s, b) => s + b.count, 0)).toBe(data.length)
  })

  it('produces contiguous, non-overlapping, ascending bin edges', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    const bins = binData(data)
    for (let i = 1; i < bins.length; i++) {
      expect(bins[i].x0).toBeCloseTo(bins[i - 1].x1, 10)
    }
  })

  it('collapses an all-identical-value dataset into a single bin', () => {
    const bins = binData([7, 7, 7, 7])
    expect(bins).toHaveLength(1)
    expect(bins[0].count).toBe(4)
  })

  it('returns an empty array for empty input', () => {
    expect(binData([])).toEqual([])
  })

  it('respects an explicit bin count', () => {
    const data = Array.from({ length: 100 }, (_, i) => i)
    expect(binData(data, 10)).toHaveLength(10)
  })
})

describe('kernelDensity', () => {
  it('returns the requested number of sample points', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(kernelDensity(data, 50)).toHaveLength(50)
  })

  it('returns an empty array for empty input', () => {
    expect(kernelDensity([])).toEqual([])
  })

  it('peaks near the mode of a tight unimodal cluster', () => {
    const data = [48, 49, 49, 50, 50, 50, 50, 51, 51, 52]
    const kde = kernelDensity(data, 200)
    const peak = kde.reduce((max, p) => (p.y > max.y ? p : max), kde[0])
    expect(peak.x).toBeGreaterThan(47)
    expect(peak.x).toBeLessThan(53)
  })

  it('produces non-negative density everywhere', () => {
    const data = [1, 2, 3, 4, 5, 100]
    for (const p of kernelDensity(data, 60)) {
      expect(p.y).toBeGreaterThanOrEqual(0)
    }
  })
})
