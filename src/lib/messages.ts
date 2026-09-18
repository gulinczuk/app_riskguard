export type MessageSeverity = 'info' | 'medio' | 'grave'
export type MessageSenderType = 'ia' | 'gestor' | 'operador'

export interface Message {
  id: number
  client_id: string
  device_id: string | null
  sender_id: string | null
  sender_type: MessageSenderType
  severity: MessageSeverity
  body: string
  created_at: string
  read_at: string | null
}
