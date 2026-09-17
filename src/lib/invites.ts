import { supabase } from './supabaseClient'
import type { ClientUser, Invite } from './types'

// Convites usam um código curto em vez do client_id cru na URL:
// - não vaza o UUID interno do cliente pra quem intercepta o link
// - dá pra revogar/expirar sem precisar trocar o client_id
// - dá pra saber quem convidou e quem aceitou (auditoria)
// O código viaja pela URL (path /convite/:code ou query ?convite=),
// nunca por localStorage — assim ele sobrevive tanto ao redirect do OAuth
// do Google quanto ao link de confirmação de e-mail (que pode abrir em
// outra aba/dispositivo).

const INVITE_PATH_RE = /^\/convite\/([A-Za-z0-9_-]+)/

/** Lê o código de convite da URL atual (path ou querystring), se houver. */
export function getInviteCodeFromLocation(): string | null {
  const pathMatch = window.location.pathname.match(INVITE_PATH_RE)
  if (pathMatch) return pathMatch[1]

  const fromQuery = new URLSearchParams(window.location.search).get('convite')
  return fromQuery || null
}

/** Monta a URL de redirect (OAuth ou confirmação de e-mail) preservando o convite. */
export function buildRedirectUrl(inviteCode?: string | null): string {
  const origin = window.location.origin
  return inviteCode ? `${origin}/convite/${inviteCode}` : origin
}

/**
 * Aceita um convite pro usuário autenticado atual: cria o vínculo em
 * client_users com role='operador' no client_id do convite. Roda como RPC
 * (SECURITY DEFINER) porque client_users não tem policy de insert direta
 * pra esse caso — a validação do código (expirado/usado/revogado) acontece
 * dentro da função, no banco.
 */
export async function acceptInvite(code: string): Promise<{ data: ClientUser | null; error: string | null }> {
  const { data, error } = await supabase.rpc('accept_invite', { p_code: code })
  if (error) return { data: null, error: error.message }
  return { data: data as ClientUser, error: null }
}

/**
 * Gera um novo convite pro client_id do gestor logado. Só funciona se o
 * usuário autenticado tiver role='gestor' (checado dentro da função RPC).
 */
export async function createInvite(): Promise<{ data: Invite | null; error: string | null }> {
  const { data, error } = await supabase.rpc('create_invite')
  if (error) return { data: null, error: error.message }
  return { data: data as Invite, error: null }
}
