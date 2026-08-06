export { BoxPlotSparkline } from './components/BoxPlotSparkline'
export type { BoxPlotSparklineProps, BoxPlotVariant, BoxPlotSize } from './components/BoxPlotSparkline'

export type { BoxPlotTheme } from './themes'
export { themes, createTheme } from './themes'

export { descriptiveStats, fiveNumberSummary, mean, stddev, skewness, kurtosis, percentileRank } from './stats/descriptive'
export type { DescriptiveStats, FiveNumberSummary } from './stats/descriptive'

export { matchDistributions, LOW_CONFIDENCE_THRESHOLD } from './stats/distribution-match'
export type { DistributionMatch } from './stats/distribution-match'

export { categoricalSummary, bellCurveOrder, countFrequencies, isValueCounts, mergedCategoryOrder } from './stats/categorical'
export type { CategoryFrequency, CategoricalSummary, ValueCounts, TrueCounts } from './stats/categorical'

export {
  diffDescriptiveStats, diffDistributionMatch, diffCategoricalSummary,
  MEAN_SHIFT_NOTABLE_SIGMA, MEAN_SHIFT_MAJOR_SIGMA,
  STDDEV_RATIO_NOTABLE, STDDEV_RATIO_MAJOR,
  N_CHANGE_NOTABLE_PCT, N_CHANGE_MAJOR_PCT,
  ENTROPY_CHANGE_NOTABLE_BITS, ENTROPY_CHANGE_MAJOR_BITS,
} from './stats/diff'
export type {
  DiffSeverity, DiffFlag, StatDelta, RangeShift, RangeShiftDirection,
  NumericDiff, ShapeDiff, CategoricalDiff, CategoryDelta, CategoryShift,
} from './stats/diff'
