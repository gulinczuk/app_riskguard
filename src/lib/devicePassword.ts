import { supabase } from './supabaseClient'

// Espelha as funções RPC de supabase/supabase_step2.sql. A senha em si
// nunca trafega de volta pro cliente — só um status (tem senha? quando foi
// trocada?), suficiente pra UI do gestor.

export interface DevicePasswordStatus {
  has_password: boolean
  updated_at: string | null
}

export async function getDevicePasswordStatus(
  deviceId: string
): Promise<{ data: DevicePasswordStatus | null; error: string | null }> {
  const { data, error } = await supabase.rpc('riskguard_get_device_password_status', {
    p_device_id: deviceId,
  })
  if (error) return { data: null, error: error.message }
  // A função retorna um "table(...)" — o client do Supabase entrega como array.
  const row = Array.isArray(data) ? data[0] : data
  return { data: (row as DevicePasswordStatus) ?? { has_password: false, updated_at: null }, error: null }
}

export async function setDevicePassword(
  deviceId: string,
  senha: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('riskguard_set_device_password', {
    p_device_id: deviceId,
    p_senha: senha,
  })
  return { error: error ? error.message : null }
}
