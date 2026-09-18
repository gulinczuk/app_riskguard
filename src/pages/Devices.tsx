import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import type { Device, Farm } from '../lib/types'

const EQUIPMENT_TYPES = ['Trator', 'Colheitadeira', 'Pulverizador', 'Plantadeira', 'Outro']

export default function Devices() {
  const { clientUser } = useAuth()
  const [devices, setDevices] = useState<Device[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [equipmentType, setEquipmentType] = useState(EQUIPMENT_TYPES[0])
  const [tractorModel, setTractorModel] = useState('')
  const [farmId, setFarmId] = useState('')
  const [saving, setSaving] = useState(false)

  // Senha do operador (Etapa 3): sem isso nenhum operador consegue logar
  // no equipamento — riskguard_set_device_password grava o hash.
  const [passwordDeviceId, setPasswordDeviceId] = useState<string | null>(null)
  const [passwordValue, setPasswordValue] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)

  async function handleSavePassword(deviceId: string) {
    setSavingPassword(true)
    setPasswordMsg(null)
    const { error: err } = await supabase.rpc('riskguard_set_device_password', {
      p_device_id: deviceId,
      p_senha: passwordValue,
    })
    setSavingPassword(false)
    if (err) {
      setPasswordMsg(err.message)
      return
    }
    setPasswordMsg('Senha salva.')
    setPasswordValue('')
    setTimeout(() => {
      setPasswordDeviceId(null)
      setPasswordMsg(null)
    }, 1200)
  }

  async function loadAll() {
    setLoading(true)
    const [devicesRes, farmsRes] = await Promise.all([
      supabase.from('devices').select('*').order('registered_at', { ascending: false }),
      supabase.from('farms').select('*').order('name'),
    ])
    if (devicesRes.error) setError(devicesRes.error.message)
    else setDevices(devicesRes.data as Device[])

    if (!farmsRes.error) {
      setFarms(farmsRes.data as Farm[])
      if (farmsRes.data && farmsRes.data.length > 0 && !farmId) {
        setFarmId(farmsRes.data[0].id)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clientUser) {
      setError('Não foi possível identificar sua conta de cliente.')
      return
    }
    if (!farmId) {
      setError('Selecione uma fazenda.')
      return
    }
    setSaving(true)
    setError(null)

    const { error } = await supabase.from('devices').insert({
      client_id: clientUser.client_id,
      name,
      equipment_type: equipmentType,
      tractor_model: tractorModel || null,
      farm_id: farmId,
      active: true,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    setTractorModel('')
    loadAll()
  }

  const farmNameById = (id: string | null) => farms.find((f) => f.id === id)?.name ?? '—'

  if (!loading && farms.length === 0) {
    return (
      <div className="max-w-lg mx-auto text-center bg-rg-dark border border-zinc-800 rounded-xl p-8 mt-8">
        <h1 className="text-xl font-bold mb-2">Cadastre uma fazenda primeiro</h1>
        <p className="text-zinc-400 mb-4">
          Todo equipamento precisa estar vinculado a uma fazenda já cadastrada.
        </p>
        <Link
          to="/fazendas"
          className="inline-block bg-risk-red hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg"
        >
          Ir para cadastro de fazendas
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-xl font-bold mb-4">Cadastrar equipamento</h1>
        <form onSubmit={handleSubmit} className="bg-rg-dark border border-zinc-800 rounded-xl p-5 space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nome / identificação *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              placeholder="Trator 03"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Tipo de equipamento *</label>
            <select
              value={equipmentType}
              onChange={(e) => setEquipmentType(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
            >
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Modelo (opcional)</label>
            <input
              value={tractorModel}
              onChange={(e) => setTractorModel(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              placeholder="John Deere 6110J"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Fazenda *</label>
            <select
              required
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-risk-red">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-risk-red hover:bg-red-700 transition-colors text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar equipamento'}
          </button>
        </form>
      </div>

      <div>
        <h1 className="text-xl font-bold mb-4">Equipamentos cadastrados</h1>
        {loading ? (
          <p className="text-zinc-400">Carregando...</p>
        ) : devices.length === 0 ? (
          <p className="text-zinc-400 bg-rg-dark border border-zinc-800 rounded-xl p-5">
            Nenhum equipamento cadastrado ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {devices.map((d) => (
              <li key={d.id} className="bg-rg-dark border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {d.name}{' '}
                    {!d.active && <span className="text-xs text-zinc-500">(inativo)</span>}
                  </p>
                  <p className="text-sm text-zinc-400">
                    {d.equipment_type}
                    {d.tractor_model ? ` · ${d.tractor_model}` : ''}
                  </p>
                  <p className="text-xs text-zinc-500">Fazenda: {farmNameById(d.farm_id)}</p>

                  {passwordDeviceId === d.id ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="password"
                        autoFocus
                        value={passwordValue}
                        onChange={(e) => setPasswordValue(e.target.value)}
                        placeholder="Nova senha (mín. 4 caracteres)"
                        className="rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1 text-sm text-white"
                      />
                      <button
                        onClick={() => handleSavePassword(d.id)}
                        disabled={savingPassword || passwordValue.length < 4}
                        className="text-xs bg-risk-red hover:bg-red-700 text-white px-2 py-1 rounded disabled:opacity-50"
                      >
                        {savingPassword ? 'Salvando...' : 'Salvar'}
                      </button>
                      <button
                        onClick={() => {
                          setPasswordDeviceId(null)
                          setPasswordValue('')
                        }}
                        className="text-xs text-zinc-500 hover:text-white"
                      >
                        Cancelar
                      </button>
                      {passwordMsg && <span className="text-xs text-zinc-400">{passwordMsg}</span>}
                    </div>
                  ) : (
                    <button
                      onClick={() => setPasswordDeviceId(d.id)}
                      className="mt-2 text-xs text-zinc-500 hover:text-white underline"
                    >
                      Senha do operador
                    </button>
                  )}
                </div>
                <Link
                  to={`/equipamentos/${d.id}`}
                  className="text-sm text-risk-red hover:underline whitespace-nowrap"
                >
                  Ver detalhes →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
