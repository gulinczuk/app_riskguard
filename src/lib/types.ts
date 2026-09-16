// Tipos espelhando exatamente o schema do Supabase (Riskguard).
// Mantenha em sincronia com Riskguard_schema_completo.sql.

export interface ClientUser {
  user_id: string
  client_id: string
  is_sompo_staff: boolean
}

export interface Farm {
  id: string
  client_id: string
  name: string
  address: string | null
  lat: number | null
  lon: number | null
  area_hectares: number | null
  created_at: string
}

export interface Device {
  id: string
  name: string
  equipment_type: string
  tractor_model: string | null
  client_id: string | null
  registered_at: string
  last_seen_at: string | null
  active: boolean
  farm_id: string | null
}

export interface Telemetry {
  id: number
  device_id: string
  ts: string
  lat: number
  lon: number
  speed_kmh: number | null
  tilt_deg: number | null
  vibration_level: number | null
  proximity_alert: boolean | null
  operation_mode: string | null
  data_source: string
  prev_hash: string | null
  record_hash: string
  created_at: string
}

export type RiskCategory = 'verde' | 'amarelo' | 'vermelho'

export interface RiskScore {
  id: number
  telemetry_id: number | null
  device_id: string
  ts: string
  score: number
  category: RiskCategory | string
  factors: Record<string, number | string> | Array<{ label: string; weight: number }> | null
  explanation: string
  short_term_prediction: string | null
  model_version: string
  created_at: string
}

export interface LongTermPrediction {
  id: number
  device_id: string
  generated_at: string
  period_start: string
  period_end: string
  risk_trend: string
  trend_score: number | null
  summary: string
  recommendation: string | null
}

export interface TheftEvent {
  id: number
  device_id: string
  ts: string
  event_type: string
  lat: number | null
  lon: number | null
  high_freq_gps: boolean
  resolved: boolean
  resolved_at: string | null
}

export interface Geofence {
  id: string
  device_id: string | null
  farm_id: string | null
  name: string
  kind: string
  polygon_geojson: {
    type: 'circle'
    center: { lat: number; lon: number }
    radius_m: number
  }
  curfew_start: string | null
  curfew_end: string | null
  created_at: string
}

export interface OperatorSession {
  id: string
  device_id: string
  operator_name: string | null
  started_at: string
  ended_at: string | null
  authorized: boolean
}
