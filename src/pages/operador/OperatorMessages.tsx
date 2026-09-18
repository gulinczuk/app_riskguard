import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { Message } from '../../lib/types'

const REFRESH_MS = 20000
const RECENT_LIMIT = 20

const SEVERITY_DOT: Record<string, string> = {
  grave: 'bg-risk-red',
  medio: 'bg-yellow-500',
  baixo: 'bg-zinc-500',
}

export default function OperatorMessages() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])

  const loadUnreadCount = useCallback(async () => {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_role', 'operador')
      .is('read_at', null)
    setUnreadCount(count ?? 0)
  }, [])

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadUnreadCount])

  async function handleOpen() {
    setOpen((v) => !v)
    if (open) return

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('recipient_role', 'operador')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT)

    const list = (data as Message[]) ?? []
    setMessages(list)

    const unreadIds = list.filter((m) => !m.read_at).map((m) => m.id)
    if (unreadIds.length > 0) {
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
      setUnreadCount(0)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="relative text-zinc-400 hover:text-white border border-zinc-700 rounded-lg px-3 py-1.5 text-sm"
      >
        Mensagens
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] leading-4 text-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-rg-dark border border-zinc-800 rounded-xl shadow-lg z-50 p-2 space-y-1">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-500 p-3">Nenhuma mensagem ainda.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="text-sm px-3 py-2 rounded-lg hover:bg-zinc-900">
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-0.5">
                {m.severity && <span className={`w-1.5 h-1.5 rounded-full ${SEVERITY_DOT[m.severity]}`} />}
                <span>{m.sender_type === 'ia' ? 'IA' : m.sender_type}</span>
                <span>· {new Date(m.created_at).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-zinc-300">{m.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
