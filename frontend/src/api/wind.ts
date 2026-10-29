import { apiClient } from './client'

/** Mirrors backend app/schemas/wind.py :: ForecastRecord */
export interface ForecastRecord {
  start_time: string
  publish_time: string
  generation_mw: number
}

/** Mirrors backend app/schemas/wind.py :: ActualRecord */
export interface ActualRecord {
  settlement_date: string
  settlement_period: number
  start_time: string
  publish_time: string
  generation_mw: number
}

/** Mirrors backend app/schemas/wind.py :: PaginatedForecasts */
export interface PaginatedForecasts {
  total: number
  limit: number
  offset: number
  cutoff: string | null
  latest_only: boolean
  items: ForecastRecord[]
}

/** Mirrors backend app/schemas/wind.py :: PaginatedActuals */
export interface PaginatedActuals {
  total: number
  limit: number
  offset: number
  items: ActualRecord[]
}

export interface PageParams {
  limit: number
  offset: number
}

export async function fetchForecasts(params: PageParams): Promise<PaginatedForecasts> {
  const { data } = await apiClient.get<PaginatedForecasts>('/forecasts', { params })
  return data
}

export async function fetchActuals(params: PageParams): Promise<PaginatedActuals> {
  const { data } = await apiClient.get<PaginatedActuals>('/actuals', { params })
  return data
}
