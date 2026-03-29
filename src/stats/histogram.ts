export interface Bin {
  x0: number
  x1: number
  count: number
}

export interface KDEPoint {
  x: number
  y: number
}

/** Sturges' rule for automatic bin count */
function sturgesBinCount(n: number): number {
  return Math.max(1, Math.ceil(Math.log2(n) + 1))
}

/** Bin data into a histogram */
export function binData(data: number[], binCount?: number): Bin[] {
  if (data.length === 0) return []

  const n = binCount ?? sturgesBinCount(data.length)
  const min = Math.min(...data)
  const max = Math.max(...data)

  // Handle all-same-value case
  if (min === max) {
    return [{ x0: min - 0.5, x1: max + 0.5, count: data.length }]
  }

  const width = (max - min) / n
  const bins: Bin[] = []

  for (let i = 0; i < n; i++) {
    bins.push({
      x0: min + i * width,
      x1: min + (i + 1) * width,
      count: 0,
    })
  }

  for (const value of data) {
    let idx = Math.floor((value - min) / width)
    if (idx >= n) idx = n - 1 // clamp max value into last bin
    bins[idx].count++
  }

  return bins
}

/** Gaussian kernel */
function gaussianKernel(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

/** Silverman's rule of thumb for bandwidth */
function silvermanBandwidth(data: number[]): number {
  const n = data.length
  if (n < 2) return 1

  const sorted = [...data].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(n * 0.25)]
  const q3 = sorted[Math.floor(n * 0.75)]
  const iqr = q3 - q1

  let sum = 0
  let sumSq = 0
  for (const x of data) {
    sum += x
    sumSq += x * x
  }
  const mean = sum / n
  const std = Math.sqrt(sumSq / n - mean * mean)

  const spread = Math.min(std, iqr / 1.34)
  return 0.9 * (spread || 1) * Math.pow(n, -0.2)
}

/** Gaussian Kernel Density Estimation */
export function kernelDensity(data: number[], numPoints: number = 80): KDEPoint[] {
  if (data.length === 0) return []

  const bandwidth = silvermanBandwidth(data)
  const min = Math.min(...data)
  const max = Math.max(...data)
  const padding = bandwidth * 3
  const start = min - padding
  const end = max + padding
  const step = (end - start) / (numPoints - 1)

  const points: KDEPoint[] = []

  for (let i = 0; i < numPoints; i++) {
    const x = start + i * step
    let density = 0
    for (const xi of data) {
      density += gaussianKernel((x - xi) / bandwidth)
    }
    density /= data.length * bandwidth
    points.push({ x, y: density })
  }

  return points
}
