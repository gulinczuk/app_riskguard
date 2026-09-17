import { useState } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { createInvite } from '../lib/invites'
import logo from '../assets/logo.png'

const navItems = [
  { to: '/', label: 'Mapa', end: true },
  { to: '/fazendas', label: 'Fazendas' },
  { to: '/equipamentos', label: 'Equipamentos' },
  { to: '/geofences', label: 'Áreas de risco' },
]

export default function Layout() {
  const { session, loading, clientUser, signOut, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rg-black text-zinc-400">
        Carregando...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Operador não deve ver as telas de gestão (fazendas, equipamentos, etc).
  if (clientUser?.role === 'operador') return <Navigate to="/operador" replace />

  return (
    <div className="min-h-screen bg-rg-black text-white flex flex-col">
      <header className="border-b border-zinc-800 bg-rg-dark">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Riskguard" className="w-8 h-8 object-contain" />
            <span className="font-bold tracking-wide">RISKGUARD</span>
          </div>
          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? 'bg-risk-red text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {clientUser?.role === 'gestor' && <InviteOperatorButton />}
            <span className="hidden md:inline text-xs text-zinc-500">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg px-3 py-1.5"
            >
              Sair
            </button>
          </div>
        </div>
        <nav className="sm:hidden flex overflow-x-auto gap-1 px-4 pb-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-risk-red text-white' : 'text-zinc-400 bg-zinc-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

// Botão + modal simples pro gestor gerar um link de convite pra um
// operador. Adicionado fora do escopo estrito da Etapa 1 só pra fechar o
// ciclo de teste ponta a ponta (sem isso não dá pra gerar um convite real
// pra testar o fluxo de cadastro). UX melhor pode vir depois.
function InviteOperatorButton() {
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingInvite, setLoadingInvite] = useState(false)

  async function handleOpen() {
    setOpen(true)
    setError(null)
    setLink(null)
    setLoadingInvite(true)
    const { data, error } = await createInvite()
    setLoadingInvite(false)
    if (error || !data) {
      setError(error ?? 'Não foi possível gerar o convite.')
      return
    }
    setLink(`${window.location.origin}/convite/${data.code}`)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg px-3 py-1.5"
      >
        Convidar operador
      </button>
      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-rg-dark border border-zinc-800 rounded-xl p-6 w-full max-w-sm space-y-3">
            <h2 className="text-white font-semibold">Convidar operador</h2>
            {loadingInvite && <p className="text-sm text-zinc-400">Gerando link...</p>}
            {error && (
              <p className="text-sm text-risk-red bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {link && (
              <div className="space-y-2">
                <p className="text-sm text-zinc-400">
                  Envie este link. Ele expira em 7 dias e só pode ser usado uma vez.
                </p>
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white text-xs"
                />
              </div>
            )}
            <button
              onClick={() => setOpen(false)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 transition-colors text-white font-medium py-2 rounded-lg"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
