import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.png'

const navItems = [
  { to: '/', label: 'Mapa', end: true },
  { to: '/fazendas', label: 'Fazendas' },
  { to: '/equipamentos', label: 'Equipamentos' },
  { to: '/geofences', label: 'Áreas de risco' },
]

export default function Layout() {
  const { session, loading, signOut, user } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rg-black text-zinc-400">
        Carregando...
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

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
