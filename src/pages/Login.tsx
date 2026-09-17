import { useState, type FormEvent } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.png'

type Mode = 'signin' | 'signup'

export default function Login() {
  const { session, loading, signIn, signUp, signInWithGoogle } = useAuth()
  // Convite chega por /convite/:code (link mandado pelo gestor) ou, no
  // retorno da confirmação de e-mail, por ?convite=CODE — ambos os casos
  // caem nessa mesma tela de login/cadastro.
  const { code: codeFromPath } = useParams<{ code?: string }>()
  const [searchParams] = useSearchParams()
  const inviteCode = codeFromPath ?? searchParams.get('convite') ?? null

  // Quem chega via link de convite normalmente ainda não tem conta —
  // começa direto na aba de cadastro, mas pode trocar pra "Entrar" se já
  // tiver uma conta e só precisar vincular o convite.
  const [mode, setMode] = useState<Mode>(inviteCode ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    if (mode === 'signin') {
      const { error } = await signIn(email, password)
      setSubmitting(false)
      if (error) setError(traduzErro(error))
      return
    }

    const { error, needsEmailConfirmation } = await signUp(email, password, inviteCode)
    setSubmitting(false)
    if (error) {
      setError(traduzErro(error))
      return
    }
    if (needsEmailConfirmation) {
      setInfo('Conta criada! Confira seu e-mail e confirme o cadastro antes de entrar.')
      setMode('signin')
    }
    // Se não precisar confirmar e-mail, o onAuthStateChange já loga o usuário.
  }

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    const { error } = await signInWithGoogle(inviteCode)
    setGoogleLoading(false)
    if (error) setError(traduzErro(error))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-rg-black px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logo} alt="Riskguard" className="w-24 h-24 object-contain mb-2" />
          <h1 className="text-2xl font-bold tracking-wide text-white">RISKGUARD</h1>
          <p className="text-sm text-zinc-400 mt-1">Monitoramento de risco em tempo real</p>
        </div>

        <div className="bg-rg-dark border border-zinc-800 rounded-xl p-6 space-y-4">
          {inviteCode && (
            <p className="text-sm text-zinc-300 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2">
              Você recebeu um convite para entrar como <strong>operador</strong> de uma empresa
              existente. Crie sua conta (ou entre, se já tiver uma) para vincular.
            </p>
          )}
          <div className="flex rounded-lg bg-zinc-900 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
                setInfo(null)
              }}
              className={`flex-1 py-1.5 rounded-md transition-colors ${
                mode === 'signin' ? 'bg-risk-red text-white' : 'text-zinc-400'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
                setInfo(null)
              }}
              className={`flex-1 py-1.5 rounded-md transition-colors ${
                mode === 'signup' ? 'bg-risk-red text-white' : 'text-zinc-400'
              }`}
            >
              Criar conta
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-100 text-zinc-900 font-semibold py-2.5 rounded-lg disabled:opacity-50 transition-colors"
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecionando...' : 'Continuar com Google'}
          </button>

          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <div className="h-px flex-1 bg-zinc-800" />
            ou com e-mail
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-risk-red"
                placeholder="voce@empresa.com"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-risk-red"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm text-risk-red bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-green-400 bg-green-950/40 border border-green-900 rounded-lg px-3 py-2">
                {info}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-risk-red hover:bg-red-700 transition-colors text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function traduzErro(msg: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'E-mail ou senha incorretos.',
    'User already registered': 'Já existe uma conta com esse e-mail. Tente entrar.',
    'Email not confirmed': 'Confirme seu e-mail antes de entrar (verifique sua caixa de entrada).',
    'Password should be at least 6 characters': 'A senha precisa ter pelo menos 6 caracteres.',
  }
  return map[msg] ?? msg
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l2.99-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
      />
    </svg>
  )
}
