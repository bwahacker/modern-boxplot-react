/**
 * Standalone entry point — bundles React internally so consumers
 * can use a single <script> tag with no build tooling.
 *
 * Usage (closing tags below are written as <\/script> - not a typo, just
 * avoiding a literal "</script>" in a comment, which would prematurely end
 * the enclosing tag if this JSDoc is ever inlined into an actual <script> block,
 * e.g. by a tool that bundles docs into a single-file HTML page):
 *   <div id="plot"></div>
 *   <script src="modern-boxplot.standalone.js"><\/script>
 *   <script>
 *     ModernBoxPlot.render(document.getElementById('plot'), {
 *       data: [1, 2, 3, 4, 5],
 *       variant: 'tufte',
 *       size: 'md',
 *       theme: 'dark',
 *     })
 *   <\/script>
 */

import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { BoxPlotSparkline } from './components/BoxPlotSparkline'
import { themes, createTheme } from './themes'
import type { BoxPlotVariant, BoxPlotSize } from './components/BoxPlotSparkline'
import type { BoxPlotTheme } from './themes'

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export interface RenderOptions {
  data: number[] | string[] | Record<string, number>
  variant?: BoxPlotVariant
  size?: BoxPlotSize
  theme?: keyof typeof themes | BoxPlotTheme
  width?: number
  height?: number
  categoryOrder?: string[]
  /** Title displayed at the top of the popover card (e.g. column name). */
  title?: string
  /** Plain-language context shown under the title. */
  description?: string
  /** Footnote displayed at the bottom of the popover card. */
  footnote?: string
  /** True non-null count for the full column, when `data` is a truncated top-N value_counts dict (e.g. top 25). Displayed as N instead of the sum of the provided categories. */
  trueTotalCount?: number
  /** True distinct-value count for the full column, when `data` is a truncated top-N value_counts dict. */
  trueUniqueCount?: number
  /** A second snapshot of the same column to compare against `data` (e.g. last week's run, or a train/test split). Same shape as `data`. */
  compareData?: number[] | string[] | Record<string, number>
  /** Label for the primary snapshot, shown only when `compareData` is present. Defaults to "Current". */
  label?: string
  /** Label for the comparison snapshot, shown only when `compareData` is present. Defaults to "Comparison". */
  compareLabel?: string
  /** trueTotalCount, but for `compareData`. */
  compareTrueTotalCount?: number
  /** trueUniqueCount, but for `compareData`. */
  compareTrueUniqueCount?: number
  /** Mark a specific value against the distribution (numeric data). */
  highlightValue?: number
  /** Mark a specific category against the distribution (categorical data). */
  highlightCategory?: string
  /** Override text shown for the highlight marker. Without it, a numeric `highlightValue` gets an auto-generated percentile label (framed by `direction` if given). */
  highlightLabel?: string
  /** Which direction is "good" for a numeric `highlightValue`, so the auto-generated label reads as "Better than X%" instead of a bare "Higher than X%". */
  direction?: 'higherIsBetter' | 'lowerIsBetter'
  /** Render lightweight min/median/max tick labels below the plot (numeric data only). */
  showAxis?: boolean
  /** Overlay a fitted Gaussian curve on the categorical popover's bar chart. Off by default. */
  showFitCurve?: boolean
  /** Show the KDE density curve on the numeric popover's histogram. Defaults to true. */
  showDensityCurve?: boolean
  /** Show the best-fit distribution card / shape-match verdict on the numeric popover. Defaults to true. */
  showDistributionMatch?: boolean
}

const roots = new WeakMap<Element, Root>()

function resolveTheme(theme?: keyof typeof themes | BoxPlotTheme): BoxPlotTheme {
  if (!theme) return themes.tufte
  if (typeof theme === 'string') return themes[theme] ?? themes.tufte
  return theme
}

/**
 * Render a box plot sparkline into a DOM element.
 * Returns a handle with `update()` and `destroy()` methods.
 */
function render(container: Element | null, options: RenderOptions) {
  if (!container) {
    throw new Error('ModernBoxPlot.render: container element is null')
  }

  let root = roots.get(container)
  if (!root) {
    root = createRoot(container)
    roots.set(container, root)
  }

  const {
    data, variant, size, theme, width, height, categoryOrder, title, description, footnote, trueTotalCount, trueUniqueCount,
    compareData, label, compareLabel, compareTrueTotalCount, compareTrueUniqueCount,
    highlightValue, highlightCategory, highlightLabel, direction, showAxis, showFitCurve,
    showDensityCurve, showDistributionMatch,
  } = options
  const resolvedTheme = resolveTheme(theme)

  root.render(
    React.createElement(BoxPlotSparkline, {
      data,
      variant,
      size,
      theme: resolvedTheme,
      width,
      height,
      categoryOrder,
      title,
      description,
      footnote,
      trueTotalCount,
      trueUniqueCount,
      compareData,
      label,
      compareLabel,
      compareTrueTotalCount,
      compareTrueUniqueCount,
      highlightValue,
      highlightCategory,
      highlightLabel,
      direction,
      showAxis,
      showFitCurve,
      showDensityCurve,
      showDistributionMatch,
    })
  )

  return {
    update(newOptions: Partial<RenderOptions>) {
      const merged = { ...options, ...newOptions }
      render(container, merged)
    },
    destroy() {
      root!.unmount()
      roots.delete(container)
    },
  }
}

/**
 * Render box plots into all elements matching a CSS selector.
 * Each element should have data attributes:
 *   data-values="1,2,3,4,5"
 *   data-variant="tufte"     (optional)
 *   data-size="md"           (optional)
 *   data-theme="dark"        (optional)
 */
function renderAll(selector: string = '[data-boxplot]') {
  const elements = document.querySelectorAll(selector)
  const handles: ReturnType<typeof render>[] = []

  elements.forEach((el) => {
    const valuesAttr = el.getAttribute('data-values')
    if (!valuesAttr) return

    const raw = valuesAttr.split(',').map(s => s.trim())
    // Auto-detect: if all values parse as numbers, treat as numeric
    const asNumbers = raw.map(Number)
    const allNumeric = asNumbers.every(n => !isNaN(n))
    const data: number[] | string[] = allNumeric ? asNumbers : raw
    if (data.length === 0) return

    const orderAttr = el.getAttribute('data-category-order')
    const categoryOrder = orderAttr ? orderAttr.split(',').map(s => s.trim()) : undefined

    const trueTotalAttr = el.getAttribute('data-true-total-count')
    const trueUniqueAttr = el.getAttribute('data-true-unique-count')

    const compareValuesAttr = el.getAttribute('data-compare-values')
    let compareData: number[] | string[] | undefined
    if (compareValuesAttr) {
      const rawCompare = compareValuesAttr.split(',').map(s => s.trim())
      const compareAsNumbers = rawCompare.map(Number)
      compareData = compareAsNumbers.every(n => !isNaN(n)) ? compareAsNumbers : rawCompare
    }
    const compareTrueTotalAttr = el.getAttribute('data-compare-true-total-count')
    const compareTrueUniqueAttr = el.getAttribute('data-compare-true-unique-count')

    const highlightValueAttr = el.getAttribute('data-highlight-value')
    const directionAttr = el.getAttribute('data-direction')

    // These two default to true on the React side (unlike showAxis/
    // showFitCurve, which default to false) - reading them the same way
    // those do (attr === 'true') would silently flip the default to false
    // for every standalone consumer who doesn't set the attribute at all.
    // Passing `undefined` when the attribute is absent lets BoxPlotSparkline's
    // own default apply; only an explicit data-*="false" turns it off.
    const showDensityCurveAttr = el.getAttribute('data-show-density-curve')
    const showDistributionMatchAttr = el.getAttribute('data-show-distribution-match')

    handles.push(render(el, {
      data,
      variant: (el.getAttribute('data-variant') as BoxPlotVariant) || undefined,
      size: (el.getAttribute('data-size') as BoxPlotSize) || undefined,
      theme: (el.getAttribute('data-theme') as keyof typeof themes) || undefined,
      categoryOrder,
      title: el.getAttribute('data-title') || undefined,
      description: el.getAttribute('data-description') || undefined,
      footnote: el.getAttribute('data-footnote') || undefined,
      trueTotalCount: trueTotalAttr ? Number(trueTotalAttr) : undefined,
      trueUniqueCount: trueUniqueAttr ? Number(trueUniqueAttr) : undefined,
      compareData,
      label: el.getAttribute('data-label') || undefined,
      compareLabel: el.getAttribute('data-compare-label') || undefined,
      compareTrueTotalCount: compareTrueTotalAttr ? Number(compareTrueTotalAttr) : undefined,
      compareTrueUniqueCount: compareTrueUniqueAttr ? Number(compareTrueUniqueAttr) : undefined,
      highlightValue: highlightValueAttr ? Number(highlightValueAttr) : undefined,
      highlightCategory: el.getAttribute('data-highlight-category') || undefined,
      highlightLabel: el.getAttribute('data-highlight-label') || undefined,
      direction: (directionAttr === 'higherIsBetter' || directionAttr === 'lowerIsBetter') ? directionAttr : undefined,
      showAxis: el.getAttribute('data-show-axis') === 'true',
      showFitCurve: el.getAttribute('data-show-fit-curve') === 'true',
      showDensityCurve: showDensityCurveAttr === null ? undefined : showDensityCurveAttr === 'true',
      showDistributionMatch: showDistributionMatchAttr === null ? undefined : showDistributionMatchAttr === 'true',
    }))
  })

  return handles
}

// Public API exposed as window.ModernBoxPlot
export { render, renderAll, themes, createTheme }
export type { BoxPlotVariant, BoxPlotSize, BoxPlotTheme, DeepPartial }
