export interface BoxPlotTheme {
  colors: {
    primary: string
    secondary: string
    accent: string
    light: string
    faint: string
    mean: string
  }
  popover: {
    bg: string
    border: string
    text: string
    textMuted: string
    rule: string
    shadow: string
    backdropColor: string
  }
  font: {
    family: string
    labelSize: number
    valueSize: number
  }
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(base: any, overrides: any): any {
  const result = { ...base }
  for (const key in overrides) {
    const val = overrides[key]
    if (val && typeof val === 'object' && !Array.isArray(val) && typeof base[key] === 'object') {
      result[key] = deepMerge(base[key], val)
    } else if (val !== undefined) {
      result[key] = val
    }
  }
  return result
}

// ── Presets ─────────────────────────────────────────────────────────────

const tufte: BoxPlotTheme = {
  colors: {
    primary: '#334155',
    secondary: '#94a3b8',
    accent: '#475569',
    light: '#cbd5e1',
    faint: '#e2e8f0',
    mean: '#dc2626',
  },
  popover: {
    bg: '#ffffff',
    border: '#1e293b',
    text: '#1e293b',
    textMuted: '#94a3b8',
    rule: '#e2e8f0',
    shadow: '0 8px 24px rgba(15, 23, 42, 0.15), 0 2px 6px rgba(15, 23, 42, 0.08)',
    backdropColor: 'rgba(15, 23, 42, 0.12)',
  },
  font: {
    family: 'system-ui, -apple-system, sans-serif',
    labelSize: 10,
    valueSize: 13,
  },
}

const dark: BoxPlotTheme = {
  colors: {
    primary: '#e2e8f0',
    secondary: '#64748b',
    accent: '#94a3b8',
    light: '#475569',
    faint: '#334155',
    mean: '#f87171',
  },
  popover: {
    bg: '#0f172a',
    border: '#334155',
    text: '#e2e8f0',
    textMuted: '#64748b',
    rule: '#1e293b',
    shadow: '0 8px 24px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.2)',
    backdropColor: 'rgba(0, 0, 0, 0.3)',
  },
  font: {
    family: 'system-ui, -apple-system, sans-serif',
    labelSize: 10,
    valueSize: 13,
  },
}

const blueprint: BoxPlotTheme = {
  colors: {
    primary: '#1d4ed8',
    secondary: '#93c5fd',
    accent: '#3b82f6',
    light: '#bfdbfe',
    faint: '#dbeafe',
    mean: '#dc2626',
  },
  popover: {
    bg: '#ffffff',
    border: '#1d4ed8',
    text: '#1e293b',
    textMuted: '#6b7280',
    rule: '#dbeafe',
    shadow: '0 8px 24px rgba(29, 78, 216, 0.12), 0 2px 6px rgba(29, 78, 216, 0.06)',
    backdropColor: 'rgba(29, 78, 216, 0.08)',
  },
  font: {
    family: 'system-ui, -apple-system, sans-serif',
    labelSize: 10,
    valueSize: 13,
  },
}

const warm: BoxPlotTheme = {
  colors: {
    primary: '#92400e',
    secondary: '#d97706',
    accent: '#b45309',
    light: '#fcd34d',
    faint: '#fef3c7',
    mean: '#dc2626',
  },
  popover: {
    bg: '#fffbeb',
    border: '#92400e',
    text: '#451a03',
    textMuted: '#a16207',
    rule: '#fde68a',
    shadow: '0 8px 24px rgba(146, 64, 14, 0.12), 0 2px 6px rgba(146, 64, 14, 0.06)',
    backdropColor: 'rgba(146, 64, 14, 0.08)',
  },
  font: {
    family: 'system-ui, -apple-system, sans-serif',
    labelSize: 10,
    valueSize: 13,
  },
}

export const themes = { tufte, dark, blueprint, warm } as const

export function createTheme(base: BoxPlotTheme, overrides: DeepPartial<BoxPlotTheme>): BoxPlotTheme {
  return deepMerge(base, overrides)
}
