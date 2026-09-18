import { supabase } from './supabaseClient'
import type { OperatorSession } from './types'

export interface StartSessionResult {
  ok: boolean
  authorized: boolean
  session: OperatorSession | null
  theft_event_id: number | null
  message: string
}

/**
 * Início de turno. Chama a RPC riskguard_start_operator_session
 * (supabase_operator_area.sql).
 *
 * - Senha certa -> authorized: true, session preenchida.
 * - Senha errada + force_start=false -> authorized: false, session: null.
 *   A tela deve então oferecer "ligar mesmo assim" chamando de novo com
 *   force_start=true.
 * - Senha errada + force_start=true -> authorized: false, session
 *   preenchida (force_started=true), e um theft_event 'uso_nao_autorizado'
 *   é criado no banco (não retornado aqui como objeto — só o id).
 */
export async function startOperatorSession(
  deviceId: string,
  senha: string,
  operatorName: string | null,
  forceStart = false
): Promise<{ data: StartSessionResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('riskguard_start_operator_session', {
    p_device_id: deviceId,
    p_senha: senha,
    p_force_start: forceStart,
    p_operator_name: operatorName,
  })
  if (error) return { data: null, error: error.message }
  return { data: data as StartSessionResult, error: null }
}

export async function endOperatorSession(sessionId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('riskguard_end_operator_session', {
    p_session_id: sessionId,
  })
  return { error: error ? error.message : null }
}

/** Sessão aberta (ended_at null) mais recente pro device, se houver. */
export async function fetchOpenSession(deviceId: string): Promise<OperatorSession | null> {
  const { data } = await supabase
    .from('operator_sessions')
    .select('*')
    .eq('device_id', deviceId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
  return (data?.[0] as OperatorSession) ?? null
}
