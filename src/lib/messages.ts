import { supabase } from './supabaseClient'
import type { Message, MessageSeverity } from './types'

// Espelha a tabela `messages` (supabase/supabase_step2.sql) e a função
// riskguard_mark_message_read. Os tipos vivem só em ./types — não duplique
// aqui, isso já causou um bug de schema divergente uma vez.

export async function listMessages(
  clientId: string,
  deviceId?: string | null
): Promise<{ data: Message[]; error: string | null }> {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (deviceId) query = query.eq('device_id', deviceId)

  const { data, error } = await query
  if (error) return { data: [], error: error.message }
  return { data: (data as Message[]) ?? [], error: null }
}

export async function sendMessage(params: {
  clientId: string
  deviceId?: string | null
  senderId: string
  senderType: 'gestor' | 'operador'
  severity?: MessageSeverity
  body: string
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('messages').insert({
    client_id: params.clientId,
    device_id: params.deviceId ?? null,
    sender_id: params.senderId,
    sender_type: params.senderType,
    severity: params.severity ?? 'info',
    body: params.body,
  })
  return { error: error ? error.message : null }
}

export async function markMessageRead(messageId: number): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('riskguard_mark_message_read', { p_message_id: messageId })
  return { error: error ? error.message : null }
}

export function countUnread(messages: Message[], recipientType: 'gestor' | 'operador'): number {
  const relevantSenders: Message['sender_type'][] =
    recipientType === 'gestor' ? ['operador'] : ['gestor', 'ia']
  return messages.filter((m) => relevantSenders.includes(m.sender_type) && !m.read_at).length
}
