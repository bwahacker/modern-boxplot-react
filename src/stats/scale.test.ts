import { describe, it, expect } from 'vitest'
import { linearScale, symlogScale, defaultLinthresh } from './scale'

describe('linearScale', () => {
  it('is the identity in both directions', () => {
    for (const v of [-100, -1, 0, 1, 100, 3.14]) {
      expect(linearScale.forward(v)).toBe(v)
      expect(linearScale.invert(v)).toBe(v)
    }
  })
})

describe('symlogScale', () => {
  it('maps zero to zero', () => {
    expect(symlogScale(1).forward(0)).toBe(0)
  })

  it('is monotonically increasing', () => {
    const s = symlogScale(1)
    const xs = [-100, -10, -1, -0.1, 0, 0.1, 1, 10, 100]
    const ys = xs.map(s.forward)
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1])
    }
  })

  it('round-trips forward/invert for positive, negative, and zero values', () => {
    const s = symlogScale(2.5)
    for (const v of [-500, -3, 0, 0.001, 7, 398]) {
      expect(s.invert(s.forward(v))).toBeCloseTo(v, 6)
    }
  })

  it('compresses large magnitudes relative to a linear scale (that is the point)', () => {
    const s = symlogScale(1)
    // Scaled distance per unit of data, near the linear region vs. far out
    // in the log-like region - should be much smaller far out.
    const perUnitNearZero = (s.forward(1) - s.forward(0)) / 1
    const perUnitFarOut = (s.forward(500) - s.forward(100)) / 400
    expect(perUnitFarOut).toBeLessThan(perUnitNearZero / 10)
  })
})

describe('defaultLinthresh', () => {
  it('picks the smallest nonzero magnitude in the data', () => {
    expect(defaultLinthresh([0, 0, 5, -2, 0, 100], 100)).toBe(2)
  })

  it('falls back to a fraction of the range when all data is zero', () => {
    expect(defaultLinthresh([0, 0, 0], 200)).toBeCloseTo(2, 6)
  })

  it('never returns zero even for a zero range', () => {
    expect(defaultLinthresh([0], 0)).toBeGreaterThan(0)
  })
})
