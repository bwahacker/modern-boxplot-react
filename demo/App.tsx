import { useState } from 'react'
import { BoxPlotSparkline, themes, mean, stddev } from '../src'
import type { BoxPlotVariant, BoxPlotSize, BoxPlotTheme } from '../src'

// ── Deterministic seeded random ────────────────────────────────────────

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

function generateUniform(n: number, a: number, b: number, seed: number): number[] {
  const rand = mulberry32(seed)
  return Array.from({ length: n }, () => a + (b - a) * rand())
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

// ── Datasets ───────────────────────────────────────────────────────────

const datasets = [
  { name: 'Patient ages', desc: 'Clinical trial cohort', data: generateNormal(200, 45, 12, 42) },
  { name: 'Response times', desc: 'API latency (ms)', data: generateLogNormal(500, 5.2, 0.7, 137) },
  { name: 'Test scores', desc: 'Standardized exam', data: generateNormal(100, 72, 8.5, 99) },
  { name: 'Sensor readings', desc: 'Temperature (°C)', data: generateUniform(400, 18, 82, 256) },
  { name: 'Wait times', desc: 'Queue duration (min)', data: generateExponential(300, 0.15, 77) },
  { name: 'City populations', desc: 'Two-cluster (k)', data: generateBimodal(250, 314) },
]

// ── Picker options ─────────────────────────────────────────────────────

const VARIANTS: { value: BoxPlotVariant; label: string; desc: string }[] = [
  { value: 'tufte', label: 'Tufte', desc: 'IQR bar with white gap at median' },
  { value: 'classic', label: 'Classic', desc: 'Filled box with end caps' },
  { value: 'minimal', label: 'Minimal', desc: 'Three vertical ticks' },
  { value: 'lollipop', label: 'Lollipop', desc: 'Dots at five-number summary' },
  { value: 'gradient', label: 'Gradient', desc: 'Opacity ramp showing density' },
  { value: 'violin', label: 'Violin', desc: 'KDE-based distribution shape' },
]

const SIZES: { value: BoxPlotSize; label: string; dims: string }[] = [
  { value: 'sm', label: 'S', dims: '80×16' },
  { value: 'md', label: 'M', dims: '120×24' },
  { value: 'lg', label: 'L', dims: '180×32' },
]

const THEMES: { value: keyof typeof themes; label: string }[] = [
  { value: 'tufte', label: 'Tufte' },
  { value: 'dark', label: 'Dark' },
  { value: 'blueprint', label: 'Blueprint' },
  { value: 'warm', label: 'Warm' },
]

function fmt(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toFixed(1)
}

// ── App ────────────────────────────────────────────────────────────────

export default function App() {
  const [variant, setVariant] = useState<BoxPlotVariant>('tufte')
  const [size, setSize] = useState<BoxPlotSize>('md')
  const [themeName, setThemeName] = useState<keyof typeof themes>('tufte')

  const activeTheme: BoxPlotTheme = themes[themeName]
  const isDark = themeName === 'dark'

  return (
    <div style={{
      maxWidth: 860, margin: '48px auto', padding: '0 24px',
      color: isDark ? '#e2e8f0' : '#1e293b',
      background: isDark ? '#0f172a' : '#ffffff',
      minHeight: '100vh',
      transition: 'background 0.2s, color 0.2s',
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 400, marginBottom: 4 }}>
        Modern Box Plot
      </h1>
      <p style={{ fontSize: 14, color: isDark ? '#64748b' : '#64748b', marginBottom: 28, lineHeight: 1.5 }}>
        Sparkline-sized distribution summaries. Click any plot to explore the full distribution,
        summary statistics, and best-fit distribution match.
      </p>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <PickerGroup label="Style" options={VARIANTS} value={variant} onChange={setVariant} isDark={isDark} />
        <PickerGroup label="Size" options={SIZES} value={size} onChange={setSize} isDark={isDark} />
        <PickerGroup label="Theme" options={THEMES} value={themeName} onChange={setThemeName} isDark={isDark} />
      </div>

      <div style={{ fontSize: 12, color: isDark ? '#475569' : '#94a3b8', marginBottom: 16 }}>
        {VARIANTS.find(o => o.value === variant)?.desc}
        {' · '}
        {SIZES.find(o => o.value === size)?.dims}px
        {' · '}
        {themeName} theme
      </div>

      {/* Data table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${isDark ? '#334155' : '#334155'}` }}>
            <th style={thStyle(isDark)}>Dataset</th>
            <th style={{ ...thStyle(isDark), textAlign: 'right' }}>n</th>
            <th style={thStyle(isDark)}>Distribution</th>
            <th style={{ ...thStyle(isDark), textAlign: 'right' }}>Mean</th>
            <th style={{ ...thStyle(isDark), textAlign: 'right' }}>Std Dev</th>
          </tr>
        </thead>
        <tbody>
          {datasets.map(ds => (
            <tr key={ds.name} style={{ borderBottom: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}` }}>
              <td style={tdStyle(isDark)}>
                <div style={{ fontWeight: 500 }}>{ds.name}</div>
                <div style={{ fontSize: 11, color: isDark ? '#475569' : '#94a3b8' }}>{ds.desc}</div>
              </td>
              <td style={{ ...tdStyle(isDark), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {ds.data.length}
              </td>
              <td style={tdStyle(isDark)}>
                <BoxPlotSparkline data={ds.data} variant={variant} size={size} theme={activeTheme} />
              </td>
              <td style={{ ...tdStyle(isDark), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(mean(ds.data))}
              </td>
              <td style={{ ...tdStyle(isDark), textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {fmt(stddev(ds.data))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Usage example */}
      <div style={{
        marginTop: 32, padding: 16,
        background: isDark ? '#1e293b' : '#f8fafc',
        borderRadius: 6,
        fontSize: 12,
        fontFamily: 'monospace',
        color: isDark ? '#94a3b8' : '#64748b',
        lineHeight: 1.6,
      }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, color: isDark ? '#475569' : '#94a3b8' }}>
          Usage
        </div>
        <code>
          {`import { BoxPlotSparkline, themes } from 'modern-boxplot-react'\n\n`}
          {`<BoxPlotSparkline\n`}
          {`  data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}\n`}
          {`  variant="${variant}"\n`}
          {`  size="${size}"\n`}
          {`  theme={themes.${themeName}}\n`}
          {`/>`}
        </code>
      </div>

      <p style={{ fontSize: 11, color: isDark ? '#334155' : '#cbd5e1', marginTop: 24, paddingBottom: 48 }}>
        Built with pure SVG and TypeScript. No charting libraries.
        {' · '}
        <a href="https://www.mitchhaile.com" style={{ color: 'inherit' }}>Mitch Haile</a>
      </p>
    </div>
  )
}

// ── Picker helper ──────────────────────────────────────────────────────

function PickerGroup<T extends string>({ label, options, value, onChange, isDark }: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  isDark: boolean
}) {
  return (
    <div>
      <div style={{
        fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: isDark ? '#475569' : '#94a3b8', marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {options.map(opt => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              style={{
                fontSize: 12, padding: '4px 10px',
                border: active
                  ? `1px solid ${isDark ? '#e2e8f0' : '#334155'}`
                  : `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                borderRadius: 3,
                background: active ? (isDark ? '#e2e8f0' : '#334155') : 'transparent',
                color: active ? (isDark ? '#0f172a' : '#ffffff') : (isDark ? '#64748b' : '#64748b'),
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function thStyle(isDark: boolean): React.CSSProperties {
  return {
    textAlign: 'left', padding: '8px 12px',
    fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: isDark ? '#475569' : '#94a3b8', fontWeight: 400,
  }
}

function tdStyle(isDark: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    color: isDark ? '#94a3b8' : '#475569',
    verticalAlign: 'middle',
  }
}
