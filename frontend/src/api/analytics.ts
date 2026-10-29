import { apiClient } from './client'

/** Mirrors backend app/schemas/analytics.py :: Methodology */
export interface Methodology {
  decision_cutoff: string
  forecast_resolution: string
  actual_resolution: string
  alignment: string
  notes: string[]
}

/**
 * Mirrors backend app/schemas/analytics.py :: AccuracySummary.
 * Dates serialize to ISO strings; mae/rmse/bias are null when paired_count === 0.
 */
export interface AccuracySummary {
  delivery_start: string
  delivery_end: string
  decision_cutoff_hour_utc: number
  sample_count: number
  paired_count: number
  missing_forecast_count: number
  mae_mw: number | null
  rmse_mw: number | null
  mean_bias_mw: number | null
  methodology: Methodology
}

export async function fetchAccuracy(): Promise<AccuracySummary> {
  const { data } = await apiClient.get<AccuracySummary>('/analysis/accuracy')
  return data
}

/** Mirrors backend app/schemas/analytics.py :: IntervalError (paired intervals only). */
export interface ComparisonInterval {
  settlement_date: string
  settlement_period: number
  start_time: string
  forecast_publish_time: string
  actual_mw: number
  forecast_mw: number
  error_mw: number
}

/** Mirrors backend app/schemas/analytics.py :: PaginatedComparison */
export interface PaginatedComparison {
  delivery_start: string
  delivery_end: string
  decision_cutoff_hour_utc: number
  total: number // paired intervals (before pagination)
  limit: number
  offset: number
  missing_forecast_count: number
  items: ComparisonInterval[]
}

export interface ComparisonParams {
  delivery_start?: string
  delivery_end?: string
  limit: number
  offset: number
}

export async function fetchComparison(params: ComparisonParams): Promise<PaginatedComparison> {
  const { data } = await apiClient.get<PaginatedComparison>('/analysis/comparison', { params })
  return data
}
