import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import type { ClientUser } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  clientUser: ClientUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [clientUser, setClientUser] = useState<ClientUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Busca o vínculo client_users do usuário logado. Se ainda não existir
  // (primeiro login via cadastro por e-mail OU via Google, que não passa
  // pelo fluxo de signUp customizado), cria automaticamente um client_id
  // novo pra essa conta — ou seja, cada cadastro novo vira um cliente novo.
  // Se o seu caso de uso for "convidar" um usuário pra um client_id já
  // existente (equipe com várias contas), essa lógica precisa mudar pra
  // usar um código de convite em vez de gerar client_id automaticamente.
  async function loadClientUser(userId: string) {
    const { data, error } = await supabase
      .from('client_users')
      .select('user_id, client_id, is_sompo_staff')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Erro ao carregar client_users:', error.message)
      setClientUser(null)
      return
    }

    if (data) {
      setClientUser(data)
      return
    }

    // Nenhum vínculo ainda: provisiona um client_id novo pra essa conta.
    const newClientUser: ClientUser = {
      user_id: userId,
      client_id: crypto.randomUUID(),
      is_sompo_staff: false,
    }

    const { data: inserted, error: insertError } = await supabase
      .from('client_users')
      .insert(newClientUser)
      .select('user_id, client_id, is_sompo_staff')
      .single()

    if (insertError) {
      console.error('Erro ao provisionar client_users:', insertError.message)
      setClientUser(null)
      return
    }

    setClientUser(inserted)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session?.user) {
        loadClientUser(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) {
        loadClientUser(newSession.user.id)
      } else {
        setClientUser(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message, needsEmailConfirmation: false }
    // Se o projeto exige confirmação de e-mail, data.session vem null aqui
    // mesmo sem erro — o usuário precisa clicar no link do e-mail antes de
    // conseguir logar.
    return { error: null, needsEmailConfirmation: !data.session }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    return { error: error ? error.message : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        clientUser,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
