# Modern Box Plot

Sparkline-sized, interactive box plot widget for React. Click any plot to explore the full distribution with a histogram, summary statistics, and automatic distribution matching.

Built with pure SVG and TypeScript — no charting libraries.

## Install

```bash
npm install modern-boxplot-react
```

## Quick Start

```tsx
import { BoxPlotSparkline, themes } from 'modern-boxplot-react'

<BoxPlotSparkline data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `number[]` | required | Raw data array |
| `variant` | `BoxPlotVariant` | `'tufte'` | Rendering style (see below) |
| `size` | `BoxPlotSize` | `'md'` | Preset dimensions (see below) |
| `theme` | `BoxPlotTheme` | `themes.tufte` | Color and typography theme |
| `width` | `number` | from size | Override width in px |
| `height` | `number` | from size | Override height in px |

## Rendering Variants

Six genuinely different SVG rendering approaches:

| Variant | Description |
|---------|-------------|
| `tufte` | Tufte's redesigned box plot: thin IQR bar with a white gap at the median |
| `classic` | Traditional filled rectangle for IQR, median line, end caps on whiskers |
| `minimal` | Three vertical ticks (Q1, median, Q3) connected by a hairline |
| `lollipop` | Dots at all five-number summary positions, connected by a line |
| `gradient` | Horizontal bar with opacity ramp showing where data concentrates |
| `violin` | Mini KDE-based shape showing the actual distribution contour |

## Sizes

| Size | Dimensions |
|------|------------|
| `sm` | 80 × 16 px |
| `md` | 120 × 24 px |
| `lg` | 180 × 32 px |

Override with `width` and `height` props for custom dimensions.

## Theming

Four built-in themes:

```tsx
import { BoxPlotSparkline, themes } from 'modern-boxplot-react'

<BoxPlotSparkline data={data} theme={themes.tufte} />     // slate grayscale (default)
<BoxPlotSparkline data={data} theme={themes.dark} />      // dark bg, light data ink
<BoxPlotSparkline data={data} theme={themes.blueprint} /> // blue tones on white
<BoxPlotSparkline data={data} theme={themes.warm} />      // earth/amber tones
```

### Custom Themes

Use `createTheme()` to override any part of a base theme:

```tsx
import { BoxPlotSparkline, themes, createTheme } from 'modern-boxplot-react'

const custom = createTheme(themes.tufte, {
  colors: { primary: '#8b5cf6', accent: '#a78bfa' },
  popover: { bg: '#faf5ff', border: '#7c3aed' },
})

<BoxPlotSparkline data={data} theme={custom} />
```

### Theme Structure

```ts
interface BoxPlotTheme {
  colors: {
    primary: string      // IQR bar, median — main data ink
    secondary: string    // Whiskers, outliers
    accent: string       // Connecting lines, subtle marks
    light: string        // Faint connecting lines
    faint: string        // Histogram bar fill, backgrounds
    mean: string         // Mean annotation color
  }
  popover: {
    bg: string           // Popover background
    border: string       // High-contrast border
    text: string         // Primary text
    textMuted: string    // Secondary text
    rule: string         // Divider lines
    shadow: string       // Box shadow
    backdropColor: string // Backdrop overlay color
  }
  font: {
    family: string       // Font stack
    labelSize: number    // Label font size (px)
    valueSize: number    // Value font size (px)
  }
}
```

## Popover Detail View

Click any sparkline to open an interactive popover showing:

- **Histogram** with density curve overlay and annotated vertical markers for min, Q1, median, mean, Q3, max
- **Summary statistics** — n, min, Q1, median, Q3, max, mean, std dev
- **Distribution matching** — best-fit against Normal, Log-Normal, Exponential, Uniform, and Bimodal distributions with similarity scores and plain-English explanations

The popover uses a backdrop blur effect and high-contrast border. Dismiss with the close button, click outside, or press Escape.

## Stats Engine

All statistics are computed in pure TypeScript with no external dependencies. You can use them directly:

```tsx
import {
  descriptiveStats,
  fiveNumberSummary,
  mean,
  stddev,
  skewness,
  kurtosis,
  matchDistributions,
} from 'modern-boxplot-react'

const stats = descriptiveStats([1, 2, 3, 4, 5])
// { n, min, max, mean, variance, stddev, skewness, kurtosis, fiveNum, outliers }

const fns = fiveNumberSummary([1, 2, 3, 4, 5])
// { min, q1, median, q3, max }

const matches = matchDistributions([1, 2, 3, 4, 5])
// [{ name, similarity, explanation }, ...]
```

### Algorithms

- Five-number summary with linear interpolation quartiles (Excel PERCENTILE.INC style)
- Skewness (Fisher's moment coefficient) and excess kurtosis
- Kolmogorov-Smirnov goodness-of-fit scoring against reference distributions
- Gaussian kernel density estimation with Silverman bandwidth

## Standalone Script Tag

For projects that don't use React, a self-contained bundle is available:

```html
<script src="https://unpkg.com/modern-boxplot-react/dist/modern-boxplot.standalone.js"></script>
<script>
  ModernBoxPlot.render(document.getElementById('plot'), {
    data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    variant: 'tufte',
    size: 'md',
    theme: 'dark',
  })
</script>
```

## Development

```bash
npm install
npm run dev          # Demo page at localhost:5173
npm run build        # Library → dist/
npm run build:demo   # Demo site build
```

## Exports

```ts
// Components
export { BoxPlotSparkline } from 'modern-boxplot-react'

// Theming
export { themes, createTheme } from 'modern-boxplot-react'

// Stats
export { descriptiveStats, fiveNumberSummary, mean, stddev, skewness, kurtosis } from 'modern-boxplot-react'
export { matchDistributions } from 'modern-boxplot-react'

// Types
export type { BoxPlotSparklineProps, BoxPlotVariant, BoxPlotSize, BoxPlotTheme } from 'modern-boxplot-react'
export type { DescriptiveStats, FiveNumberSummary, DistributionMatch } from 'modern-boxplot-react'
```

## Author

**Mitch Haile**
- [mitchhaile.com](https://www.mitchhaile.com)
- [mitch.haile@gmail.com](mailto:mitch.haile@gmail.com)

## License

MIT
