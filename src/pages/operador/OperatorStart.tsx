import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { startOperatorSession } from '../../lib/operator'
import type { Device, OperatorSession } from '../../lib/types'

interface Props {
  onStarted: (session: OperatorSession) => void
}

export default function OperatorStart({ onStarted }: Props) {
  const { user } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [deviceId, setDeviceId] = useState('')
  const [senha, setSenha] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrongPassword, setWrongPassword] = useState(false)

  useEffect(() => {
    supabase
      .from('devices')
      .select('*')
      .eq('active', true)
      .order('name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else {
          setDevices((data as Device[]) ?? [])
          if (data && data.length > 0) setDeviceId(data[0].id)
        }
        setLoading(false)
      })
  }, [])

  async function attempt(forceStart: boolean) {
    if (!deviceId) return
    setSubmitting(true)
    setError(null)

    const { data, error: err } = await startOperatorSession(
      deviceId,
      senha,
      user?.email ?? null,
      forceStart
    )

    setSubmitting(false)

    if (err) {
      setError(err)
      return
    }
    if (!data) return

    if (data.authorized) {
      setWrongPassword(false)
      if (data.session) onStarted(data.session)
      return
    }

    if (forceStart) {
      setWrongPassword(false)
      if (data.session) onStarted(data.session)
      return
    }

    setWrongPassword(true)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    attempt(false)
  }

  const selectedDevice = devices.find((d) => d.id === deviceId)

  if (loading) return <p className="text-zinc-400">Carregando equipamentos...</p>

  if (devices.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center bg-rg-dark border border-zinc-800 rounded-xl p-8 mt-8">
        <h1 className="text-xl font-bold mb-2">Nenhum equipamento disponível</h1>
        <p className="text-zinc-400">Peça ao gestor para cadastrar e liberar um equipamento pra você.</p>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-1">Início de turno</h1>
      <p className="text-zinc-400 text-sm mb-6">Escolha o equipamento e digite a senha pra ligar.</p>

      <form onSubmit={handleSubmit} className="bg-rg-dark border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Equipamento</label>
          <select
            value={deviceId}
            onChange={(e) => {
              setDeviceId(e.target.value)
              setWrongPassword(false)
            }}
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.equipment_type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Senha do equipamento</label>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => {
              setSenha(e.target.value)
              setWrongPassword(false)
            }}
            className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
            placeholder="••••••"
          />
        </div>

        {error && <p className="text-sm text-risk-red">{error}</p>}

        {wrongPassword && (
          <div className="bg-yellow-950/40 border border-yellow-800 rounded-lg p-3 space-y-2">
            <p className="text-sm text-yellow-400">
              Senha incorreta para {selectedDevice?.name ?? 'este equipamento'}.
            </p>
            <p className="text-xs text-zinc-400">
              Se você tem autorização pra ligar mesmo assim, isso vai ser registrado como uso não
              autorizado e o gestor será notificado.
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => attempt(true)}
              className="w-full bg-yellow-700 hover:bg-yellow-600 text-white text-sm font-semibold py-2 rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Ligando...' : 'Ligar mesmo assim'}
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-risk-red hover:bg-red-700 transition-colors text-white font-semibold py-2.5 rounded-lg disabled:opacity-50"
        >
          {submitting ? 'Verificando...' : 'Ligar equipamento'}
        </button>
      </form>
    </div>
  )
}
