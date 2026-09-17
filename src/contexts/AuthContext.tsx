import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { acceptInvite, buildRedirectUrl, getInviteCodeFromLocation } from '../lib/invites'
import type { ClientUser } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  clientUser: ClientUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    inviteCode?: string | null
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  signInWithGoogle: (inviteCode?: string | null) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [clientUser, setClientUser] = useState<ClientUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Busca o vínculo client_users do usuário logado.
  //
  // Se ainda não existir:
  //  - Se a URL atual carrega um código de convite (/convite/:code ou
  //    ?convite=CODE — sobrevive tanto ao redirect do OAuth do Google
  //    quanto ao link de confirmação de e-mail), o vínculo é criado pela
  //    RPC accept_invite, no client_id do convite, com role='operador'.
  //  - Caso contrário, mantém o comportamento antigo: provisiona um
  //    client_id novo pra essa conta, como role='gestor' (fluxo "criar
  //    empresa"). Isso preserva o app funcionando pra quem já usa o
  //    cadastro normal sem convite.
  async function loadClientUser(userId: string) {
    const { data, error } = await supabase
      .from('client_users')
      .select('user_id, client_id, is_sompo_staff, role')
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

    const inviteCode = getInviteCodeFromLocation()

    if (inviteCode) {
      const { data: viaInvite, error: inviteError } = await acceptInvite(inviteCode)
      if (viaInvite) {
        setClientUser(viaInvite)
        return
      }
      // Convite inválido/expirado/já usado: não deixa o usuário travado sem
      // client_id nenhum — cai pro fluxo padrão (vira gestor de uma empresa
      // nova) e avisa no console. A tela de login pode futuramente checar
      // isso e mostrar um aviso mais explícito ao usuário.
      console.warn('Convite inválido, expirado ou já usado; criando empresa nova:', inviteError)
    }

    // Nenhum vínculo e nenhum convite válido: provisiona um client_id novo
    // pra essa conta, como gestor (dono da empresa recém-criada).
    const newClientUser: ClientUser = {
      user_id: userId,
      client_id: crypto.randomUUID(),
      is_sompo_staff: false,
      role: 'gestor',
    }

    const { data: inserted, error: insertError } = await supabase
      .from('client_users')
      .insert(newClientUser)
      .select('user_id, client_id, is_sompo_staff, role')
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

  async function signUp(email: string, password: string, inviteCode?: string | null) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Preserva o código de convite no link de confirmação de e-mail: ele
      // pode abrir em outra aba/dispositivo, então não dá pra depender de
      // estado em memória ou localStorage — tem que ir na própria URL.
      options: inviteCode ? { emailRedirectTo: buildRedirectUrl(inviteCode) } : undefined,
    })
    if (error) return { error: error.message, needsEmailConfirmation: false }
    // Se o projeto exige confirmação de e-mail, data.session vem null aqui
    // mesmo sem erro — o usuário precisa clicar no link do e-mail antes de
    // conseguir logar.
    return { error: null, needsEmailConfirmation: !data.session }
  }

  async function signInWithGoogle(inviteCode?: string | null) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: buildRedirectUrl(inviteCode) },
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
