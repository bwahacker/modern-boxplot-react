/**
 * Standalone entry point — bundles React internally so consumers
 * can use a single <script> tag with no build tooling.
 *
 * Usage:
 *   <div id="plot"></div>
 *   <script src="modern-boxplot.standalone.js"></script>
 *   <script>
 *     ModernBoxPlot.render(document.getElementById('plot'), {
 *       data: [1, 2, 3, 4, 5],
 *       variant: 'tufte',
 *       size: 'md',
 *       theme: 'dark',
 *     })
 *   </script>
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
  /** Footnote displayed at the bottom of the popover card. */
  footnote?: string
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

  const { data, variant, size, theme, width, height, categoryOrder, title, footnote } = options
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
      footnote,
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

    handles.push(render(el, {
      data,
      variant: (el.getAttribute('data-variant') as BoxPlotVariant) || undefined,
      size: (el.getAttribute('data-size') as BoxPlotSize) || undefined,
      theme: (el.getAttribute('data-theme') as keyof typeof themes) || undefined,
      categoryOrder,
      title: el.getAttribute('data-title') || undefined,
      footnote: el.getAttribute('data-footnote') || undefined,
    }))
  })

  return handles
}

// Public API exposed as window.ModernBoxPlot
export { render, renderAll, themes, createTheme }
export type { BoxPlotVariant, BoxPlotSize, BoxPlotTheme, DeepPartial }
