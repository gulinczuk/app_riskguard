import { useEffect, useState, useCallback, type FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import type { Device, RiskScore, TheftEvent, Telemetry, LongTermPrediction } from '../lib/types'
import RiskBadge from '../components/RiskBadge'
import FactorsBar from '../components/FactorsBar'
import MessagesPanel from '../components/MessagesPanel'
import { getDevicePasswordStatus, setDevicePassword, type DevicePasswordStatus } from '../lib/devicePassword'

type HistoryItem =
  | { kind: 'telemetry'; ts: string; data: Telemetry }
  | { kind: 'risk_score'; ts: string; data: RiskScore }
  | { kind: 'theft_event'; ts: string; data: TheftEvent }

const HISTORY_LIMIT = 40

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, clientUser } = useAuth()

  const [device, setDevice] = useState<Device | null>(null)
  const [latestRisk, setLatestRisk] = useState<RiskScore | null>(null)
  const [longTerm, setLongTerm] = useState<LongTermPrediction | null>(null)
  const [openTheftEvents, setOpenTheftEvents] = useState<TheftEvent[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [passwordStatus, setPasswordStatus] = useState<DevicePasswordStatus | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const [acknowledging, setAcknowledging] = useState(false)
  const [ackNotes, setAckNotes] = useState('')

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [deviceRes, riskRes, longTermRes, theftRes, telemetryHistRes, riskHistRes, theftHistRes] =
      await Promise.all([
        supabase.from('devices').select('*').eq('id', id).single(),
        supabase.from('risk_scores').select('*').eq('device_id', id).order('ts', { ascending: false }).limit(1),
        supabase
          .from('long_term_predictions')
          .select('*')
          .eq('device_id', id)
          .order('generated_at', { ascending: false })
          .limit(1),
        supabase.from('theft_events').select('*').eq('device_id', id).eq('resolved', false).order('ts', { ascending: false }),
        supabase.from('telemetry').select('*').eq('device_id', id).order('ts', { ascending: false }).limit(HISTORY_LIMIT),
        supabase.from('risk_scores').select('*').eq('device_id', id).order('ts', { ascending: false }).limit(HISTORY_LIMIT),
        supabase.from('theft_events').select('*').eq('device_id', id).order('ts', { ascending: false }).limit(HISTORY_LIMIT),
      ])

    if (deviceRes.error) setError(deviceRes.error.message)
    else setDevice(deviceRes.data as Device)

    setLatestRisk((riskRes.data?.[0] as RiskScore) ?? null)
    setLongTerm((longTermRes.data?.[0] as LongTermPrediction) ?? null)
    setOpenTheftEvents((theftRes.data as TheftEvent[]) ?? [])

    const combined: HistoryItem[] = [
      ...((telemetryHistRes.data as Telemetry[]) ?? []).map((t) => ({ kind: 'telemetry' as const, ts: t.ts, data: t })),
      ...((riskHistRes.data as RiskScore[]) ?? []).map((r) => ({ kind: 'risk_score' as const, ts: r.ts, data: r })),
      ...((theftHistRes.data as TheftEvent[]) ?? []).map((e) => ({ kind: 'theft_event' as const, ts: e.ts, data: e })),
    ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

    setHistory(combined.slice(0, HISTORY_LIMIT))
    setLoading(false)

    const { data: pwStatus } = await getDevicePasswordStatus(id)
    setPasswordStatus(pwStatus)
  }, [id])

  useEffect(() => {
    loadAll()
    const interval = setInterval(loadAll, 20000)
    return () => clearInterval(interval)
  }, [loadAll])

  async function handleSetPassword(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setSavingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(false)
    const { error } = await setDevicePassword(id, newPassword)
    setSavingPassword(false)
    if (error) {
      setPasswordError(error)
      return
    }
    setNewPassword('')
    setPasswordSuccess(true)
    const { data: pwStatus } = await getDevicePasswordStatus(id)
    setPasswordStatus(pwStatus)
  }

  async function handleAcknowledge() {
    if (!latestRisk) return
    setAcknowledging(true)
    const { error } = await supabase.rpc('riskguard_acknowledge_risk_score', {
      p_score_id: latestRisk.id,
      p_notes: ackNotes || null,
    })
    setAcknowledging(false)
    if (error) {
      setError(`Não foi possível revisar o score: ${error.message}`)
      return
    }
    setAckNotes('')
    loadAll()
  }

  async function handleResolve(eventId: number) {
    if (!user) return
    setResolvingId(eventId)
    const { error } = await supabase.rpc('resolve_theft_event', {
      event_id: eventId,
      resolved_by: user.id,
    })
    setResolvingId(null)
    if (error) {
      setError(`Não foi possível resolver o evento: ${error.message}`)
      return
    }
    loadAll()
  }

  if (loading && !device) return <p className="text-zinc-400">Carregando...</p>
  if (!device) return <p className="text-risk-red">Equipamento não encontrado.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/equipamentos" className="text-sm text-zinc-500 hover:text-white">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold">{device.name}</h1>
          <p className="text-zinc-400 text-sm">
            {device.equipment_type}
            {device.tractor_model ? ` · ${device.tractor_model}` : ''}
          </p>
        </div>
        {latestRisk && <RiskBadge category={latestRisk.category} score={Number(latestRisk.score)} />}
      </div>

      {error && (
        <p className="text-sm text-risk-red bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">{error}</p>
      )}

      {openTheftEvents.length > 0 && (
        <div className="border-2 border-risk-red rounded-xl p-5 bg-red-950/30 space-y-4 animate-pulse-slow">
          <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">🚨 Alerta de possível furto</h2>
          {openTheftEvents.map((ev) => (
            <div key={ev.id} className="bg-rg-black/60 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-semibold">{ev.event_type}</p>
                <p className="text-sm text-zinc-400">{new Date(ev.ts).toLocaleString('pt-BR')}</p>
                {ev.lat != null && ev.lon != null && (
                  <p className="text-xs text-zinc-500">
                    Última posição conhecida: {ev.lat.toFixed(5)}, {ev.lon.toFixed(5)}
                  </p>
                )}
                {ev.high_freq_gps && <p className="text-xs text-yellow-400">GPS em alta frequência ativado</p>}
              </div>
              <button
                onClick={() => handleResolve(ev.id)}
                disabled={resolvingId === ev.id}
                className="bg-risk-red hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap"
              >
                {resolvingId === ev.id ? 'Resolvendo...' : 'Marcar como resolvido'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-rg-dark border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-3">Painel de risco</h2>
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

              <div className="pt-3 border-t border-zinc-800">
                {latestRisk.acknowledged_at ? (
                  <p className="text-xs text-zinc-500">
                    ✓ Revisado em {new Date(latestRisk.acknowledged_at).toLocaleString('pt-BR')}
                    {latestRisk.resolution_notes ? ` — "${latestRisk.resolution_notes}"` : ''}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <input
                      value={ackNotes}
                      onChange={(e) => setAckNotes(e.target.value)}
                      placeholder="Observação (opcional)"
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs text-white"
                    />
                    <button
                      onClick={handleAcknowledge}
                      disabled={acknowledging}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 transition-colors text-white font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      {acknowledging ? 'Salvando...' : 'Marcar score como revisado'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">Ainda não há score de risco calculado para este equipamento.</p>
          )}

          {longTerm && (
            <div className="mt-5 pt-4 border-t border-zinc-800">
              <p className="text-sm font-semibold text-zinc-400 mb-1">Tendência de longo prazo: {longTerm.risk_trend}</p>
              <p className="text-sm text-zinc-300">{longTerm.summary}</p>
              {longTerm.recommendation && (
                <p className="text-sm text-zinc-400 mt-1">
                  <span className="text-zinc-500">Recomendação: </span>
                  {longTerm.recommendation}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-rg-dark border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-bold mb-3">Histórico (caixa-preta)</h2>
          <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
            {history.length === 0 && <p className="text-sm text-zinc-500">Sem registros ainda.</p>}
            {history.map((item, i) => (
              <HistoryRow key={`${item.kind}-${i}`} item={item} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-rg-dark border border-zinc-800 rounded-xl p-5 space-y-3">
          <h2 className="text-lg font-bold">Senha do equipamento</h2>
          <p className="text-sm text-zinc-400">
            O operador usa essa senha pra iniciar o turno nessa máquina. A senha em si
            nunca é mostrada de novo depois de salva.
          </p>
          {passwordStatus?.has_password && (
            <p className="text-xs text-zinc-500">
              Senha definida{passwordStatus.updated_at ? ` · última troca em ${new Date(passwordStatus.updated_at).toLocaleString('pt-BR')}` : ''}
            </p>
          )}
          <form onSubmit={handleSetPassword} className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={passwordStatus?.has_password ? 'Nova senha' : 'Definir senha (mín. 4 caracteres)'}
              minLength={4}
              required
              className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white text-sm"
            />
            <button
              type="submit"
              disabled={savingPassword}
              className="bg-risk-red hover:bg-red-700 transition-colors text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50 whitespace-nowrap"
            >
              {savingPassword ? 'Salvando...' : passwordStatus?.has_password ? 'Trocar senha' : 'Definir senha'}
            </button>
          </form>
          {passwordError && <p className="text-sm text-risk-red">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-green-400">Senha salva com sucesso.</p>}
        </div>

        {clientUser && user && (
          <MessagesPanel
            clientId={clientUser.client_id}
            deviceId={id}
            currentUserId={user.id}
            role="gestor"
          />
        )}
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

  if (item.kind === 'risk_score') {
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

  const e = item.data
  return (
    <div className="text-sm border-l-2 border-yellow-600 pl-3 py-1">
      <span className="text-zinc-500 text-xs">{time}</span>
      <p className="text-zinc-300">
        Evento: {e.event_type} {e.resolved ? '(resolvido)' : '(em aberto)'}
      </p>
    </div>
  )
}
