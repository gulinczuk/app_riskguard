import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import OperatorStart from './OperatorStart'
import OperatorDashboard from './OperatorDashboard'
import type { OperatorSession } from '../../lib/types'

export default function OperatorHome() {
  const { user } = useAuth()
  const [session, setSession] = useState<OperatorSession | null>(null)
  const [loading, setLoading] = useState(true)

  const loadOpenSession = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('operator_sessions')
      .select('*')
      .eq('operator_user_id', user.id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
    setSession((data?.[0] as OperatorSession) ?? null)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadOpenSession()
  }, [loadOpenSession])

  if (loading) return <p className="text-zinc-400">Carregando...</p>

  if (!session) {
    return <OperatorStart onStarted={(s) => setSession(s)} />
  }

  return <OperatorDashboard session={session} onEnded={() => setSession(null)} />
}
