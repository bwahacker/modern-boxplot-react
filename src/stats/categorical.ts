// ── Types ──────────────────────────────────────────────────────────────

export interface CategoryFrequency {
  label: string
  count: number
  position: number     // 1-based position after ordering
  proportion: number   // count / total
}

export interface CategoricalSummary {
  categories: CategoryFrequency[]  // in display order
  totalCount: number
  numCategories: number
  mode: string
  modeCount: number
  encodedData: number[]            // each observation → its category's position
  entropy: number                  // Shannon entropy (bits)
}

// ── Frequency counting ────────────────────────────────────────────────

export function countFrequencies(data: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const d of data) {
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  return counts
}

// ── Bell-curve ordering ───────────────────────────────────────────────
// Sort categories by count descending, then place the highest-count
// category in the center, alternating right/left with decreasing counts.
// This produces a roughly bell-shaped frequency profile.

export function bellCurveOrder(counts: Map<string, number>): string[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return []
  if (sorted.length === 1) return [sorted[0][0]]

  const n = sorted.length
  const result: string[] = new Array(n)
  const mid = Math.floor(n / 2)

  // Place highest-count category in center
  result[mid] = sorted[0][0]

  let left = mid - 1
  let right = mid + 1
  for (let i = 1; i < n; i++) {
    if (i % 2 === 1 && right < n) {
      result[right] = sorted[i][0]
      right++
    } else if (left >= 0) {
      result[left] = sorted[i][0]
      left--
    } else {
      result[right] = sorted[i][0]
      right++
    }
  }

  return result
}

// ── Encode categorical → numeric ──────────────────────────────────────

export function encodeCategorical(data: string[], order: string[]): number[] {
  const posMap = new Map<string, number>()
  order.forEach((label, i) => posMap.set(label, i + 1))
  return data.map(d => posMap.get(d) ?? 0)
}

// ── Shannon entropy ───────────────────────────────────────────────────

function shannonEntropy(counts: Map<string, number>, total: number): number {
  let h = 0
  for (const c of counts.values()) {
    if (c === 0) continue
    const p = c / total
    h -= p * Math.log2(p)
  }
  return h
}

// ── Histogram / value_counts input ────────────────────────────────────

export type ValueCounts = Record<string, number>

export function isValueCounts(data: unknown): data is ValueCounts {
  return (
    data !== null &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    Object.values(data as Record<string, unknown>).every(v => typeof v === 'number')
  )
}

export function countsFromValueCounts(vc: ValueCounts): Map<string, number> {
  const counts = new Map<string, number>()
  for (const [k, v] of Object.entries(vc)) {
    if (v > 0) counts.set(k, v)
  }
  return counts
}

// ── Main summary function ─────────────────────────────────────────────

export function categoricalSummary(
  data: string[] | ValueCounts,
  categoryOrder?: string[],
): CategoricalSummary {
  const isVC = isValueCounts(data)
  const counts = isVC ? countsFromValueCounts(data) : countFrequencies(data as string[])
  let total = 0
  for (const c of counts.values()) total += c

  // Determine ordering
  let order: string[]
  if (categoryOrder && categoryOrder.length > 0) {
    // Use explicit order, append any categories not listed
    const seen = new Set(categoryOrder)
    const extra = [...counts.keys()].filter(k => !seen.has(k))
    order = [...categoryOrder.filter(k => counts.has(k)), ...extra]
  } else {
    order = bellCurveOrder(counts)
  }

  // Build category frequencies
  const categories: CategoryFrequency[] = order.map((label, i) => ({
    label,
    count: counts.get(label) ?? 0,
    position: i + 1,
    proportion: (counts.get(label) ?? 0) / total,
  }))

  // Mode
  let mode = order[0]
  let modeCount = 0
  for (const [label, count] of counts) {
    if (count > modeCount) {
      mode = label
      modeCount = count
    }
  }

  // Build encoded data: for raw arrays use direct mapping, for value_counts expand
  let encodedData: number[]
  if (isVC) {
    const posMap = new Map<string, number>()
    order.forEach((label, i) => posMap.set(label, i + 1))
    encodedData = []
    for (const [label, count] of counts) {
      const pos = posMap.get(label) ?? 0
      for (let j = 0; j < count; j++) encodedData.push(pos)
    }
  } else {
    encodedData = encodeCategorical(data as string[], order)
  }

  return {
    categories,
    totalCount: total,
    numCategories: order.length,
    mode,
    modeCount,
    encodedData,
    entropy: shannonEntropy(counts, total),
  }
}

// ── Bell-shapedness scoring ───────────────────────────────────────────
// Compares the frequency profile to a discrete Gaussian with matched
// mean and standard deviation. Returns 0–1 similarity.

export function categoricalNormalFit(
  categories: CategoryFrequency[],
): { similarity: number; explanation: string } {
  const n = categories.length
  if (n < 3) {
    return { similarity: 0, explanation: 'Too few categories to assess bell-shapedness.' }
  }

  const total = categories.reduce((s, c) => s + c.count, 0)
  if (total === 0) {
    return { similarity: 0, explanation: 'No observations.' }
  }

  // Compute weighted mean and stddev of positions
  let wMean = 0
  for (const c of categories) {
    wMean += c.position * c.count
  }
  wMean /= total

  let wVar = 0
  for (const c of categories) {
    wVar += c.count * (c.position - wMean) ** 2
  }
  wVar /= total
  const wStd = Math.sqrt(wVar) || 1

  // Compute expected proportions from a discrete Gaussian
  const expectedRaw: number[] = []
  let rawSum = 0
  for (const c of categories) {
    const z = (c.position - wMean) / wStd
    const density = Math.exp(-0.5 * z * z)
    expectedRaw.push(density)
    rawSum += density
  }

  // Normalize and compute chi-squared-style distance
  let chiSq = 0
  for (let i = 0; i < n; i++) {
    const observed = categories[i].proportion
    const expected = expectedRaw[i] / rawSum
    if (expected > 0) {
      chiSq += (observed - expected) ** 2 / expected
    }
  }

  // Convert to 0–1 similarity (lower chi-sq → higher similarity)
  const similarity = Math.max(0, Math.min(1, 1 - chiSq * 1.5))

  let explanation: string
  if (similarity > 0.8) {
    explanation = `The frequency profile closely matches a bell curve (${(similarity * 100).toFixed(0)}% similarity). Categories are well-balanced around a central peak.`
  } else if (similarity > 0.5) {
    explanation = `The frequency profile partially resembles a bell curve (${(similarity * 100).toFixed(0)}% similarity). Some asymmetry or irregular spacing is present.`
  } else {
    explanation = `The frequency profile does not closely match a bell curve (${(similarity * 100).toFixed(0)}% similarity). The distribution across categories is irregular.`
  }

  return { similarity, explanation }
}
