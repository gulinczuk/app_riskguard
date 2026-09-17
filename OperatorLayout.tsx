import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import logo from '../../assets/logo.png'

// Layout mínimo pra área do operador. Conteúdo de verdade (navegação,
// telas) vem na Etapa 3 — por enquanto só garante o roteamento por role.
export default function OperatorLayout() {
  const { session, loading, clientUser, signOut, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rg-black text-zinc-400">
        Carregando...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  // Gestor não deve ver a área do operador.
  if (clientUser?.role === 'gestor') return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-rg-black text-white flex flex-col">
      <header className="border-b border-zinc-800 bg-rg-dark">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Riskguard" className="w-8 h-8 object-contain" />
            <span className="font-bold tracking-wide">RISKGUARD</span>
            <span className="text-xs text-zinc-500 border border-zinc-700 rounded px-2 py-0.5">
              Operador
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-zinc-500">{user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg px-3 py-1.5"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
