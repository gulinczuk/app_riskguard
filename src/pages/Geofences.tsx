import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Farm, Geofence } from '../lib/types'

const KINDS = ['area_permitida', 'area_risco', 'toque_de_recolher']

export default function Geofences() {
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [kind, setKind] = useState(KINDS[0])
  const [farmId, setFarmId] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [radius, setRadius] = useState('500')
  const [curfewStart, setCurfewStart] = useState('')
  const [curfewEnd, setCurfewEnd] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    setLoading(true)
    const [geoRes, farmsRes] = await Promise.all([
      supabase.from('geofences').select('*').order('created_at', { ascending: false }),
      supabase.from('farms').select('*').order('name'),
    ])
    if (geoRes.error) setError(geoRes.error.message)
    else setGeofences(geoRes.data as Geofence[])
    if (!farmsRes.error) setFarms(farmsRes.data as Farm[])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!lat || !lon || !radius) {
      setError('Preencha latitude, longitude e raio.')
      return
    }
    setSaving(true)
    setError(null)

    const { error } = await supabase.from('geofences').insert({
      name,
      kind,
      farm_id: farmId || null,
      polygon_geojson: {
        type: 'circle',
        center: { lat: Number(lat), lon: Number(lon) },
        radius_m: Number(radius),
      },
      curfew_start: curfewStart || null,
      curfew_end: curfewEnd || null,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    setLat('')
    setLon('')
    setRadius('500')
    setCurfewStart('')
    setCurfewEnd('')
    loadAll()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <h1 className="text-xl font-bold mb-4">Cadastrar área de risco / permitida</h1>
        <form onSubmit={handleSubmit} className="bg-rg-dark border border-zinc-800 rounded-xl p-5 space-y-3">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nome *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              placeholder="Perímetro da sede"
            />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Tipo *</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Fazenda (opcional)</label>
            <select
              value={farmId}
              onChange={(e) => setFarmId(e.target.value)}
              className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
            >
              <option value="">—</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Latitude *</label>
              <input
                required
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                type="number"
                step="any"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Longitude *</label>
              <input
                required
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                type="number"
                step="any"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Raio (m) *</label>
              <input
                required
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                type="number"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Toque de recolher — início</label>
              <input
                value={curfewStart}
                onChange={(e) => setCurfewStart(e.target.value)}
                type="time"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Toque de recolher — fim</label>
              <input
                value={curfewEnd}
                onChange={(e) => setCurfewEnd(e.target.value)}
                type="time"
                className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
              />
            </div>
          </div>

          {error && <p className="text-sm text-risk-red">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="bg-risk-red hover:bg-red-700 transition-colors text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar área'}
          </button>
        </form>
      </div>

      <div>
        <h1 className="text-xl font-bold mb-4">Áreas cadastradas</h1>
        {loading ? (
          <p className="text-zinc-400">Carregando...</p>
        ) : geofences.length === 0 ? (
          <p className="text-zinc-400 bg-rg-dark border border-zinc-800 rounded-xl p-5">Nenhuma área cadastrada.</p>
        ) : (
          <ul className="space-y-2">
            {geofences.map((g) => (
              <li key={g.id} className="bg-rg-dark border border-zinc-800 rounded-xl p-4">
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm text-zinc-400">{g.kind.replace(/_/g, ' ')}</p>
                {g.polygon_geojson?.type === 'circle' && (
                  <p className="text-xs text-zinc-500">
                    Centro: {g.polygon_geojson.center.lat.toFixed(4)}, {g.polygon_geojson.center.lon.toFixed(4)} · raio{' '}
                    {g.polygon_geojson.radius_m}m
                  </p>
                )}
                {(g.curfew_start || g.curfew_end) && (
                  <p className="text-xs text-zinc-500">
                    Toque de recolher: {g.curfew_start ?? '—'} às {g.curfew_end ?? '—'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
