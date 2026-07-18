export { BoxPlotSparkline } from './components/BoxPlotSparkline'
export type { BoxPlotSparklineProps, BoxPlotVariant, BoxPlotSize } from './components/BoxPlotSparkline'

export type { BoxPlotTheme } from './themes'
export { themes, createTheme } from './themes'

export { descriptiveStats, fiveNumberSummary, mean, stddev, skewness, kurtosis } from './stats/descriptive'
export type { DescriptiveStats, FiveNumberSummary } from './stats/descriptive'

export { matchDistributions } from './stats/distribution-match'
export type { DistributionMatch } from './stats/distribution-match'

export { categoricalSummary, bellCurveOrder, countFrequencies, isValueCounts } from './stats/categorical'
export type { CategoryFrequency, CategoricalSummary, ValueCounts, TrueCounts } from './stats/categorical'
