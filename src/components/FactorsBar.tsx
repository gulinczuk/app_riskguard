interface Props {
  factors: unknown
}

interface NormalizedFactor {
  label: string
  weight: number
}

function normalize(factors: unknown): NormalizedFactor[] {
  if (!factors) return []

  if (Array.isArray(factors)) {
    return factors
      .map((f) => {
        if (f && typeof f === 'object' && 'label' in f) {
          const obj = f as { label: unknown; weight?: unknown; value?: unknown }
          const weightRaw = obj.weight ?? obj.value ?? 0
          return { label: String(obj.label), weight: Number(weightRaw) || 0 }
        }
        return null
      })
      .filter((f): f is NormalizedFactor => f !== null)
  }

  if (typeof factors === 'object') {
    return Object.entries(factors as Record<string, unknown>).map(([label, value]) => ({
      label,
      weight: Number(value) || 0,
    }))
  }

  return []
}

export default function FactorsBar({ factors }: Props) {
  const items = normalize(factors).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Sem detalhamento de fatores para este score.</p>
  }

  const max = Math.max(...items.map((i) => Math.abs(i.weight)), 1)

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = Math.min(100, (Math.abs(item.weight) / max) * 100)
        const isNegative = item.weight < 0
        return (
          <div key={item.label}>
            <div className="flex justify-between text-xs text-zinc-400 mb-0.5">
              <span className="capitalize">{item.label.replace(/_/g, ' ')}</span>
              <span>{item.weight}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${isNegative ? 'bg-zinc-500' : 'bg-risk-red'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
