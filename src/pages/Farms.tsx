import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import type { Farm } from '../lib/types'

export default function Farms() {
  const { clientUser } = useAuth()
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [areaHa, setAreaHa] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadFarms() {
    setLoading(true)
    const { data, error } = await supabase
      .from('farms')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setFarms(data as Farm[])
    setLoading(false)
  }

  useEffect(() => {
    loadFarms()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clientUser) {
      setError('Não foi possível identificar sua conta de cliente.')
      return
    }
    setSaving(true)
    setError(null)

    const { error } = await supabase.from('farms').insert({
      client_id: clientUser.client_id,
      name,
      address: address || null,
      lat: lat ? Number(lat) : null,
      lon: lon ? Number(lon) : null,
      area_hectares: areaHa ? Number(areaHa) : null,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    setAddress('')
    setLat('')
    setLon('')
    setAreaHa('')
    loadFarms()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-xl font-bold mb-4">Cadastrar fazenda</h1>
        <form onSubmit={handleSubmit} className="bg-rg-dark border border-zinc-800 rounded-xl p-5 space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nome *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              placeholder="Fazenda Santa Fé"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Endereço</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              placeholder="Zona rural, km 12"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Latitude</label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                type="number"
                step="any"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                placeholder="-23.55"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Longitude</label>
              <input
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                type="number"
                step="any"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
                placeholder="-46.63"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Área (hectares)</label>
            <input
              value={areaHa}
              onChange={(e) => setAreaHa(e.target.value)}
              type="number"
              step="any"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              placeholder="150"
            />
          </div>

          {error && <p className="text-sm text-risk-red">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-risk-red hover:bg-red-700 transition-colors text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar fazenda'}
          </button>
        </form>
      </div>

      <div>
        <h1 className="text-xl font-bold mb-4">Fazendas cadastradas</h1>
        {loading ? (
          <p className="text-zinc-400">Carregando...</p>
        ) : farms.length === 0 ? (
          <p className="text-zinc-400 bg-rg-dark border border-zinc-800 rounded-xl p-5">
            Nenhuma fazenda cadastrada ainda. Cadastre uma para poder registrar equipamentos.
          </p>
        ) : (
          <ul className="space-y-2">
            {farms.map((farm) => (
              <li key={farm.id} className="bg-rg-dark border border-zinc-800 rounded-xl p-4">
                <p className="font-semibold">{farm.name}</p>
                {farm.address && <p className="text-sm text-zinc-400">{farm.address}</p>}
                <div className="flex gap-4 text-xs text-zinc-500 mt-1">
                  {farm.lat != null && farm.lon != null && (
                    <span>
                      {farm.lat.toFixed(4)}, {farm.lon.toFixed(4)}
                    </span>
                  )}
                  {farm.area_hectares != null && <span>{farm.area_hectares} ha</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
