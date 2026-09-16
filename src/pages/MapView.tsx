import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Device, Telemetry, RiskCategory } from '../lib/types'
import { categoryHex } from '../components/RiskBadge'

interface DevicePosition {
  device: Device
  telemetry: Telemetry
  category: RiskCategory | string | null
}

const TRAIL_POINTS = 30
const DEFAULT_CENTER: [number, number] = [-23.55, -46.63] // fallback: São Paulo
const REFRESH_MS = 15000

export default function MapView() {
  const [positions, setPositions] = useState<DevicePosition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [trail, setTrail] = useState<[number, number][]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPositions = useCallback(async () => {
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select('*')
      .eq('active', true)

    if (devicesError) {
      setError(devicesError.message)
      setLoading(false)
      return
    }

    const results: DevicePosition[] = []

    await Promise.all(
      (devices as Device[]).map(async (device) => {
        const { data: telemetryRows } = await supabase
          .from('telemetry')
          .select('*')
          .eq('device_id', device.id)
          .order('ts', { ascending: false })
          .limit(1)

        const latest = telemetryRows?.[0] as Telemetry | undefined
        if (!latest) return

        const { data: riskRows } = await supabase
          .from('risk_scores')
          .select('category')
          .eq('device_id', device.id)
          .order('ts', { ascending: false })
          .limit(1)

        results.push({
          device,
          telemetry: latest,
          category: riskRows?.[0]?.category ?? null,
        })
      })
    )

    setPositions(results)
    setLoading(false)
    setError(null)
  }, [])

  useEffect(() => {
    loadPositions()
    const interval = setInterval(loadPositions, REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadPositions])

  useEffect(() => {
    if (!selectedId) {
      setTrail([])
      return
    }
    supabase
      .from('telemetry')
      .select('lat, lon')
      .eq('device_id', selectedId)
      .order('ts', { ascending: false })
      .limit(TRAIL_POINTS)
      .then(({ data }) => {
        if (data) {
          const points: [number, number][] = (data as { lat: number; lon: number }[])
            .map((p): [number, number] => [p.lat, p.lon])
            .reverse()
          setTrail(points)
        }
      })
  }, [selectedId])

  const center: [number, number] =
    positions.length > 0 ? [positions[0].telemetry.lat, positions[0].telemetry.lon] : DEFAULT_CENTER

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Mapa em tempo real</h1>
        {error && <span className="text-sm text-risk-red">{error}</span>}
        {!loading && positions.length === 0 && !error && (
          <span className="text-sm text-zinc-500">Nenhum dado de telemetria ainda</span>
        )}
      </div>

      <div className="h-[70vh] rounded-xl overflow-hidden border border-zinc-800">
        <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {trail.length > 1 && <Polyline positions={trail} pathOptions={{ color: '#dc2626', weight: 3, opacity: 0.6 }} />}

          {positions.map(({ device, telemetry, category }) => (
            <CircleMarker
              key={device.id}
              center={[telemetry.lat, telemetry.lon]}
              radius={selectedId === device.id ? 11 : 8}
              pathOptions={{
                color: categoryHex(category ?? ''),
                fillColor: categoryHex(category ?? ''),
                fillOpacity: 0.85,
                weight: 2,
              }}
              eventHandlers={{ click: () => setSelectedId(device.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                {device.name}
              </Tooltip>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{device.name}</p>
                  <p>{device.equipment_type}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(telemetry.ts).toLocaleString('pt-BR')}
                  </p>
                  <Link to={`/equipamentos/${device.id}`} className="text-red-600 underline">
                    Ver painel de risco →
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {positions.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-4">
          {positions.map(({ device, category }) => (
            <button
              key={device.id}
              onClick={() => setSelectedId(device.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border ${
                selectedId === device.id ? 'border-risk-red bg-red-950/30' : 'border-zinc-800 bg-rg-dark'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: categoryHex(category ?? '') }}
              />
              {device.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
