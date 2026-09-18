import { useEffect, useState, type FormEvent } from 'react'
import type { Message, MessageSeverity } from '../lib/types'
import { listMessages, markMessageRead, sendMessage } from '../lib/messages'

const SEVERITY_LABEL: Record<MessageSeverity, string> = {
  info: 'Info',
  medio: 'Médio',
  grave: 'Grave',
}

const SEVERITY_CLASS: Record<MessageSeverity, string> = {
  info: 'bg-zinc-800 text-zinc-300',
  medio: 'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  grave: 'bg-red-950/50 text-risk-red border border-red-900 animate-pulse-slow',
}

const SENDER_LABEL: Record<Message['sender_type'], string> = {
  gestor: 'Gestor',
  operador: 'Operador',
  ia: 'IA',
}

interface MessagesPanelProps {
  clientId: string
  deviceId?: string | null
  currentUserId: string
  /** Papel de quem está vendo o painel — define o que conta como "não lida" e quem ele pode enviar como. */
  role: 'gestor' | 'operador'
  /** Recarrega a cada N ms além do primeiro load. Default 15s (mesmo padrão do resto do app). */
  pollIntervalMs?: number
}

export default function MessagesPanel({
  clientId,
  deviceId,
  currentUserId,
  role,
  pollIntervalMs = 15000,
}: MessagesPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState<MessageSeverity>('info')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await listMessages(clientId, deviceId)
    if (error) setError(error)
    else setMessages(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, pollIntervalMs)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, deviceId])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!body.trim()) return
    setSending(true)
    setError(null)
    const { error } = await sendMessage({
      clientId,
      deviceId,
      senderId: currentUserId,
      senderType: role,
      severity,
      body: body.trim(),
    })
    setSending(false)
    if (error) {
      setError(error)
      return
    }
    setBody('')
    setSeverity('info')
    load()
  }

  async function handleMarkRead(id: number) {
    await markMessageRead(id)
    load()
  }

  return (
    <div className="bg-rg-dark border border-zinc-800 rounded-xl p-5 space-y-4">
      <h2 className="text-lg font-bold">
        Mensagens{deviceId ? ' deste equipamento' : ''}
      </h2>

      <form onSubmit={handleSend} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={role === 'gestor' ? 'Escreva uma mensagem para o operador...' : 'Escreva uma mensagem para o gestor...'}
          rows={2}
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white text-sm resize-none"
        />
        <div className="flex items-center justify-between gap-2">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as MessageSeverity)}
            className="rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300"
          >
            <option value="info">Info</option>
            <option value="medio">Médio</option>
            <option value="grave">Grave</option>
          </select>
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="bg-risk-red hover:bg-red-700 transition-colors text-white text-sm font-semibold px-4 py-1.5 rounded-lg disabled:opacity-50"
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
        {error && <p className="text-sm text-risk-red">{error}</p>}
      </form>

      <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
        {loading && <p className="text-sm text-zinc-500">Carregando...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhuma mensagem ainda.</p>
        )}
        {messages.map((m) => {
          const isUnread = !m.read_at && m.sender_type !== role
          return (
            <div
              key={m.id}
              className={`text-sm rounded-lg px-3 py-2 border ${
                isUnread ? 'bg-blue-950/30 border-blue-800' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  {isUnread && <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />}
                  <span className="text-xs font-semibold text-zinc-300">
                    {SENDER_LABEL[m.sender_type]}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${SEVERITY_CLASS[m.severity]}`}>
                    {SEVERITY_LABEL[m.severity]}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-500">
                  {new Date(m.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <p className="text-zinc-200">{m.body}</p>
              {isUnread && (
                <button
                  onClick={() => handleMarkRead(m.id)}
                  className="mt-1 text-[11px] text-blue-400 hover:underline"
                >
                  Marcar como lida
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
