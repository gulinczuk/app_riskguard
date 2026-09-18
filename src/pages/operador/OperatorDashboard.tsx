import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import RiskBadge from '../../components/RiskBadge'
import FactorsBar from '../../components/FactorsBar'
import OperatorTheftMap from './OperatorTheftMap'
import { endOperatorSession } from '../../lib/operator'
import type { Device, RiskScore, TheftEvent, Telemetry, OperatorSession } from '../../lib/types'

type HistoryItem =
  | { kind: 'telemetry'; ts: string; data: Telemetry }
  | { kind: 'risk_score'; ts: string; data: RiskScore }

const HISTORY_LIMIT = 40
const REFRESH_MS = 20000

interface Props {
  session: OperatorSession
  onEnded: () => void
}

export default function OperatorDashboard({ session, onEnded }: Props) {
  const [device, setDevice] = useState<Device | null>(null)
  const [latestRisk, setLatestRisk] = useState<RiskScore | null>(null)
  const [openUnauthorized, setOpenUnauthorized] = useState<TheftEvent | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    const [deviceRes, riskRes, theftRes, telemetryHistRes, riskHistRes] = await Promise.all([
      supabase.from('devices').select('*').eq('id', session.device_id).single(),
      supabase
        .from('risk_scores')
        .select('*')
        .eq('device_id', session.device_id)
        .order('ts', { ascending: false })
        .limit(1),
      supabase
        .from('theft_events')
        .select('*')
        .eq('device_id', session.device_id)
        .eq('event_type', 'uso_nao_autorizado')
        .eq('resolved', false)
        .order('ts', { ascending: false })
        .limit(1),
      supabase
        .from('telemetry')
        .select('*')
        .eq('device_id', session.device_id)
        .gte('ts', session.started_at)
        .order('ts', { ascending: false })
        .limit(HISTORY_LIMIT),
      supabase
        .from('risk_scores')
        .select('*')
        .eq('device_id', session.device_id)
        .gte('ts', session.started_at)
        .order('ts', { ascending: false })
        .limit(HISTORY_LIMIT),
    ])

    if (deviceRes.error) setError(deviceRes.error.message)
    else setDevice(deviceRes.data as Device)

    setLatestRisk((riskRes.data?.[0] as RiskScore) ?? null)
    setOpenUnauthorized((theftRes.data?.[0] as TheftEvent) ?? null)

    const combined: HistoryItem[] = [
      ...((telemetryHistRes.data as Telemetry[]) ?? []).map((t) => ({ kind: 'telemetry' as const, ts: t.ts, data: t })),
      ...((riskHistRes.data as RiskScore[]) ?? []).map((r) => ({ kind: 'risk_score' as const, ts: r.ts, data: r })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

    setHistory(combined.slice(0, HISTORY_LIMIT))
    setLoading(false)
  }, [session.device_id, session.started_at])

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, REFRESH_MS)
    return () => clearInterval(interval)
  }, [loadAll])

  async function handleEndShift() {
    setEnding(true)
    const { error: err } = await endOperatorSession(session.id)
    setEnding(false)
    if (err) {
      setError(err)
      return
    }
    onEnded()
  }

  if (loading && !device) return <p className="text-zinc-400">Carregando...</p>
  if (!device) return <p className="text-risk-red">Equipamento não encontrado.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{device.name}</h1>
          <p className="text-zinc-400 text-sm">
            {device.equipment_type}
            {device.tractor_model ? ` · ${device.tractor_model}` : ''}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Turno iniciado às {new Date(session.started_at).toLocaleString('pt-BR')}
            {session.force_started && ' · sem autorização'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {latestRisk && <RiskBadge category={latestRisk.category} score={Number(latestRisk.score)} />}
          <button
            onClick={handleEndShift}
            disabled={ending}
            className="text-sm text-zinc-400 hover:text-white border border-zinc-700 rounded-lg px-3 py-1.5 disabled:opacity-50 whitespace-nowrap"
          >
            {ending ? 'Encerrando...' : 'Encerrar turno'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-risk-red bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>
      )}

      {openUnauthorized && (
        <div className="border-2 border-risk-red rounded-xl p-5 bg-red-950/30 space-y-4">
          <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
            🚨 Uso não autorizado registrado nesta sessão
          </h2>
          <p className="text-sm text-zinc-300">
            Este equipamento foi ligado com senha incorreta às{' '}
            {new Date(openUnauthorized.ts).toLocaleString('pt-BR')}. Localização acompanhada abaixo.
          </p>
          <OperatorTheftMap deviceId={device.id} />
        </div>
      )}

      <div className="bg-rg-dark border border-zinc-800 rounded-xl p-5">
        <h2 className="text-lg font-bold mb-3">Onde a IA está atuando</h2>
        {latestRisk ? (
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">{Number(latestRisk.score).toFixed(0)}</span>
              <span className="text-zinc-500 text-sm">/ 100</span>
              <RiskBadge category={latestRisk.category} />
            </div>
            <p className="text-sm text-zinc-300">{latestRisk.explanation}</p>
            {latestRisk.short_term_prediction && (
              <p className="text-sm text-zinc-400 border-l-2 border-risk-red pl-3">
                <span className="text-zinc-500">Previsão de curto prazo: </span>
                {latestRisk.short_term_prediction}
              </p>
            )}
            <div>
              <p className="text-sm font-semibold text-zinc-400 mb-2">O que está pesando no score</p>
              <FactorsBar factors={latestRisk.factors} />
            </div>
            <p className="text-xs text-zinc-600">
              Atualizado em {new Date(latestRisk.ts).toLocaleString('pt-BR')} · modelo {latestRisk.model_version}
            </p>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">Ainda não há score de risco calculado para este equipamento.</p>
        )}
      </div>

      <div className="bg-rg-dark border border-zinc-800 rounded-xl p-5">
        <h2 className="text-lg font-bold mb-3">Caixa-preta desta sessão</h2>
        <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
          {history.length === 0 && <p className="text-sm text-zinc-500">Sem registros ainda nesta sessão.</p>}
          {history.map((item, i) => (
            <HistoryRow key={`${item.kind}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const time = new Date(item.ts).toLocaleString('pt-BR')

  if (item.kind === 'telemetry') {
    const t = item.data
    return (
      <div className="text-sm border-l-2 border-zinc-700 pl-3 py-1">
        <span className="text-zinc-500 text-xs">{time}</span>
        <p className="text-zinc-300">
          Telemetria · {t.speed_kmh != null ? `${t.speed_kmh} km/h` : ''}
          {t.tilt_deg != null ? ` · inclinação ${t.tilt_deg}°` : ''}
          {t.proximity_alert ? ' · ⚠️ proximidade' : ''}
        </p>
      </div>
    )
  }

  const r = item.data
  return (
    <div className="text-sm border-l-2 border-risk-red pl-3 py-1">
      <span className="text-zinc-500 text-xs">{time}</span>
      <p className="text-zinc-300">
        Score de risco: {Number(r.score).toFixed(0)} ({r.category})
      </p>
    </div>
  )
}
