import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import { supabase } from '../../lib/supabaseClient'
import type { Telemetry } from '../../lib/types'

const REFRESH_MS = 15000
const DEFAULT_CENTER: [number, number] = [-23.55, -46.63]

// ATENÇÃO — leia antes de "corrigir" isto:
// O firmware ESP32 atual (riskguard_gga_atualizado.ino) não tem módulo GPS
// de verdade: ele grava sempre a coordenada fixa da fazenda em cada
// telemetria. Este mapa funciona (busca e plota o ponto normalmente), mas
// o marcador só vai de fato "andar" quando o hardware ganhar um GPS real.
// Até lá, isso aqui mostra uma posição fixa — não é rastreamento ao vivo,
// mesmo parecendo um mapa em tempo real. Não remova este aviso sem
// confirmar que o firmware já manda coordenadas reais.
export default function OperatorTheftMap({ deviceId }: { deviceId: string }) {
  const [point, setPoint] = useState<Telemetry | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('telemetry')
      .select('*')
      .eq('device_id', deviceId)
      .order('ts', { ascending: false })
      .limit(1)
    setPoint((data?.[0] as Telemetry) ?? null)
    setLoading(false)
  }, [deviceId])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  const center: [number, number] = point ? [point.lat, point.lon] : DEFAULT_CENTER

  return (
    <div>
      <div className="h-64 rounded-xl overflow-hidden border border-risk-red">
        <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {point && (
            <CircleMarker
              center={[point.lat, point.lon]}
              radius={10}
              pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.85, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -8]} permanent>
                {new Date(point.ts).toLocaleTimeString('pt-BR')}
              </Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      {!loading && !point && (
        <p className="text-xs text-zinc-500 mt-1">Sem telemetria ainda para este equipamento.</p>
      )}
      <p className="text-xs text-zinc-600 mt-1">
        Posição via GPS fixo da fazenda (firmware atual não tem GPS real) — atualiza a cada 15s.
      </p>
    </div>
  )
}
