import type { DescriptiveStats } from './descriptive'
import type { CategoricalSummary } from './categorical'
import { DistributionMatch, LOW_CONFIDENCE_THRESHOLD } from './distribution-match'

// ── Shared types ─────────────────────────────────────────────────────

export type DiffSeverity = 'minor' | 'notable' | 'major'

export interface DiffFlag {
  field: string
  severity: DiffSeverity
  message: string
}

export interface StatDelta {
  a: number
  b: number
  delta: number
  /** null when `a` is 0 - a percentage change from zero is meaningless. */
  deltaPct: number | null
}

function makeDelta(a: number, b: number): StatDelta {
  const delta = b - a
  return { a, b, delta, deltaPct: a === 0 ? null : delta / a }
}

function fmt(n: number): string {
  return Math.abs(n) < 0.01 && n !== 0 ? n.toExponential(1) : n.toFixed(2)
}

// ── Numeric diff ─────────────────────────────────────────────────────

export const MEAN_SHIFT_NOTABLE_SIGMA = 0.2
export const MEAN_SHIFT_MAJOR_SIGMA = 0.5
export const STDDEV_RATIO_NOTABLE: readonly [number, number] = [0.8, 1.25]
export const STDDEV_RATIO_MAJOR: readonly [number, number] = [0.5, 2]
export const N_CHANGE_NOTABLE_PCT = 0.1
export const N_CHANGE_MAJOR_PCT = 0.25

export type RangeShiftDirection = 'expanded' | 'contracted' | 'shifted-up' | 'shifted-down' | 'unchanged'

export interface RangeShift {
  direction: RangeShiftDirection
  /** How far the bounds moved, normalized by snapshot A's range (0 = no movement). */
  magnitude: number
}

function computeRangeShift(aMin: number, aMax: number, bMin: number, bMax: number): RangeShift {
  const aRange = aMax - aMin
  const minDelta = bMin - aMin
  const maxDelta = bMax - aMax
  const eps = aRange === 0 ? 1e-9 : aRange * 0.01

  let direction: RangeShiftDirection
  if (Math.abs(minDelta) <= eps && Math.abs(maxDelta) <= eps) {
    direction = 'unchanged'
  } else if (minDelta <= -eps && maxDelta >= eps) {
    direction = 'expanded'
  } else if (minDelta >= eps && maxDelta <= -eps) {
    direction = 'contracted'
  } else if (minDelta > eps && maxDelta > eps) {
    direction = 'shifted-up'
  } else if (minDelta < -eps && maxDelta < -eps) {
    direction = 'shifted-down'
  } else {
    // Only one bound moved meaningfully - describe by whichever moved further.
    direction = Math.abs(maxDelta) >= Math.abs(minDelta)
      ? (maxDelta > 0 ? 'shifted-up' : 'shifted-down')
      : (minDelta > 0 ? 'shifted-up' : 'shifted-down')
  }

  const magnitude = aRange === 0 ? 0 : Math.max(Math.abs(minDelta), Math.abs(maxDelta)) / aRange
  return { direction, magnitude }
}

export interface NumericDiff {
  n: StatDelta
  mean: StatDelta
  median: StatDelta
  stddev: StatDelta
  min: StatDelta
  max: StatDelta
  q1: StatDelta
  q3: StatDelta
  rangeShift: RangeShift
  flags: DiffFlag[]
}

export function diffDescriptiveStats(a: DescriptiveStats, b: DescriptiveStats): NumericDiff {
  const flags: DiffFlag[] = []

  const pooledStddev = Math.sqrt((a.stddev ** 2 + b.stddev ** 2) / 2) || 1
  const meanShiftSigma = (b.mean - a.mean) / pooledStddev
  const absSigma = Math.abs(meanShiftSigma)
  if (absSigma > MEAN_SHIFT_MAJOR_SIGMA) {
    flags.push({ field: 'mean', severity: 'major', message: `Mean shifted by ${meanShiftSigma.toFixed(2)}σ (${fmt(a.mean)} → ${fmt(b.mean)}).` })
  } else if (absSigma > MEAN_SHIFT_NOTABLE_SIGMA) {
    flags.push({ field: 'mean', severity: 'notable', message: `Mean shifted by ${meanShiftSigma.toFixed(2)}σ (${fmt(a.mean)} → ${fmt(b.mean)}).` })
  }

  const stddevRatio = a.stddev === 0 ? (b.stddev === 0 ? 1 : Infinity) : b.stddev / a.stddev
  if (stddevRatio < STDDEV_RATIO_MAJOR[0] || stddevRatio > STDDEV_RATIO_MAJOR[1]) {
    flags.push({ field: 'stddev', severity: 'major', message: `Spread changed substantially (std ${fmt(a.stddev)} → ${fmt(b.stddev)}).` })
  } else if (stddevRatio < STDDEV_RATIO_NOTABLE[0] || stddevRatio > STDDEV_RATIO_NOTABLE[1]) {
    flags.push({ field: 'stddev', severity: 'notable', message: `Spread changed (std ${fmt(a.stddev)} → ${fmt(b.stddev)}).` })
  }

  const nDeltaPct = a.n === 0 ? null : Math.abs(b.n - a.n) / a.n
  if (nDeltaPct !== null && nDeltaPct > N_CHANGE_MAJOR_PCT) {
    flags.push({ field: 'n', severity: 'major', message: `Row count changed by ${(nDeltaPct * 100).toFixed(0)}% (${a.n.toLocaleString()} → ${b.n.toLocaleString()}).` })
  } else if (nDeltaPct !== null && nDeltaPct > N_CHANGE_NOTABLE_PCT) {
    flags.push({ field: 'n', severity: 'notable', message: `Row count changed by ${(nDeltaPct * 100).toFixed(0)}% (${a.n.toLocaleString()} → ${b.n.toLocaleString()}).` })
  }

  return {
    n: makeDelta(a.n, b.n),
    mean: makeDelta(a.mean, b.mean),
    median: makeDelta(a.median, b.median),
    stddev: makeDelta(a.stddev, b.stddev),
    min: makeDelta(a.min, b.min),
    max: makeDelta(a.max, b.max),
    q1: makeDelta(a.q1, b.q1),
    q3: makeDelta(a.q3, b.q3),
    rangeShift: computeRangeShift(a.min, a.max, b.min, b.max),
    flags,
  }
}

// ── Distribution-shape diff ─────────────────────────────────────────

export interface ShapeDiff {
  from: string
  to: string
  changed: boolean
  fromSimilarity: number
  toSimilarity: number
  /** True when either side's own best match was already a weak fit - a "change" between two bad fits is much less meaningful than one between two confident ones. */
  isLowConfidence: boolean
  flags: DiffFlag[]
}

export function diffDistributionMatch(a: DistributionMatch[], b: DistributionMatch[]): ShapeDiff {
  const from = a[0]?.name ?? 'Unknown'
  const to = b[0]?.name ?? 'Unknown'
  const fromSimilarity = a[0]?.similarity ?? 0
  const toSimilarity = b[0]?.similarity ?? 0
  const changed = from !== to
  const isLowConfidence = fromSimilarity < LOW_CONFIDENCE_THRESHOLD || toSimilarity < LOW_CONFIDENCE_THRESHOLD

  const flags: DiffFlag[] = []
  if (changed) {
    flags.push({
      field: 'shape',
      severity: isLowConfidence ? 'minor' : 'major',
      message: `Best-fit shape changed from ${from} (${Math.round(fromSimilarity * 100)}%) to ${to} (${Math.round(toSimilarity * 100)}%).`,
    })
  }

  return { from, to, changed, fromSimilarity, toSimilarity, isLowConfidence, flags }
}

// ── Categorical diff ─────────────────────────────────────────────────

export const ENTROPY_CHANGE_NOTABLE_BITS = 0.25
export const ENTROPY_CHANGE_MAJOR_BITS = 0.75

export interface CategoryDelta {
  label: string
  count: number
  proportion: number
}

export interface CategoryShift {
  label: string
  proportionA: number
  proportionB: number
  delta: number
}

export interface CategoricalDiff {
  totalCount: StatDelta
  numCategories: StatDelta
  entropy: StatDelta
  mode: { a: string; b: string; changed: boolean; aProportion: number; bProportion: number }
  /** Present with count > 0 in A (current), absent or zero in B (comparison). */
  newCategories: CategoryDelta[]
  /** Present with count > 0 in B (comparison), absent or zero in A (current). */
  vanishedCategories: CategoryDelta[]
  /** Categories present in both, sorted by |proportion delta| descending. */
  biggestShifts: CategoryShift[]
  flags: DiffFlag[]
  /** Set when either summary is truncated - new/vanished detection only covers the shown categories. */
  caveat?: string
}

export function diffCategoricalSummary(a: CategoricalSummary, b: CategoricalSummary): CategoricalDiff {
  const flags: DiffFlag[] = []

  const entropyDelta = b.entropy - a.entropy
  if (Math.abs(entropyDelta) > ENTROPY_CHANGE_MAJOR_BITS) {
    flags.push({ field: 'entropy', severity: 'major', message: `Entropy changed by ${entropyDelta.toFixed(2)} bits (${a.entropy.toFixed(2)} → ${b.entropy.toFixed(2)}).` })
  } else if (Math.abs(entropyDelta) > ENTROPY_CHANGE_NOTABLE_BITS) {
    flags.push({ field: 'entropy', severity: 'notable', message: `Entropy changed by ${entropyDelta.toFixed(2)} bits (${a.entropy.toFixed(2)} → ${b.entropy.toFixed(2)}).` })
  }

  const aCatMap = new Map(a.categories.map(c => [c.label, c]))
  const bCatMap = new Map(b.categories.map(c => [c.label, c]))
  const aModeProportion = aCatMap.get(a.mode)?.proportion ?? 0
  const bModeProportion = bCatMap.get(b.mode)?.proportion ?? 0
  const modeChanged = a.mode !== b.mode

  if (modeChanged) {
    flags.push({
      field: 'mode',
      severity: 'major',
      message: `Mode changed from "${a.mode}" (${(aModeProportion * 100).toFixed(0)}%) to "${b.mode}" (${(bModeProportion * 100).toFixed(0)}%).`,
    })
  }

  // `a` is the current/primary snapshot and `b` is the one being compared
  // against (typically an earlier baseline) - so "new" means present now
  // but not in the comparison snapshot, and "vanished" means the reverse.
  const newCategories: CategoryDelta[] = a.categories
    .filter(c => c.count > 0 && !bCatMap.get(c.label)?.count)
    .map(c => ({ label: c.label, count: c.count, proportion: c.proportion }))
  const vanishedCategories: CategoryDelta[] = b.categories
    .filter(c => c.count > 0 && !aCatMap.get(c.label)?.count)
    .map(c => ({ label: c.label, count: c.count, proportion: c.proportion }))

  if (newCategories.length > 0) {
    flags.push({
      field: 'categories',
      severity: 'notable',
      message: `${newCategories.length} new categor${newCategories.length === 1 ? 'y' : 'ies'} appeared: ${newCategories.map(c => c.label).join(', ')}.`,
    })
  }
  if (vanishedCategories.length > 0) {
    flags.push({
      field: 'categories',
      severity: 'notable',
      message: `${vanishedCategories.length} categor${vanishedCategories.length === 1 ? 'y' : 'ies'} vanished: ${vanishedCategories.map(c => c.label).join(', ')}.`,
    })
  }

  const biggestShifts: CategoryShift[] = [...aCatMap.keys()]
    .filter(label => {
      const bCat = bCatMap.get(label)
      if (!bCat) return false
      const aCat = aCatMap.get(label)!
      return aCat.count > 0 || bCat.count > 0
    })
    .map(label => {
      const proportionA = aCatMap.get(label)!.proportion
      const proportionB = bCatMap.get(label)!.proportion
      return { label, proportionA, proportionB, delta: proportionB - proportionA }
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, 5)

  return {
    totalCount: makeDelta(a.trueTotalCount ?? a.totalCount, b.trueTotalCount ?? b.totalCount),
    numCategories: makeDelta(a.trueUniqueCount ?? a.numCategories, b.trueUniqueCount ?? b.numCategories),
    entropy: makeDelta(a.entropy, b.entropy),
    mode: { a: a.mode, b: b.mode, changed: modeChanged, aProportion: aModeProportion, bProportion: bModeProportion },
    newCategories,
    vanishedCategories,
    biggestShifts,
    flags,
    caveat: (a.isTruncated || b.isTruncated)
      ? 'One or both snapshots only show their top categories - new/vanished category detection is limited to what is shown.'
      : undefined,
  }
}
