import type { RiskCategory } from '../lib/types'

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  verde: { bg: 'bg-green-950/40', text: 'text-green-400', label: 'Baixo risco', dot: 'bg-risk-green' },
  amarelo: { bg: 'bg-yellow-950/40', text: 'text-yellow-400', label: 'Atenção', dot: 'bg-risk-yellow' },
  vermelho: { bg: 'bg-red-950/40', text: 'text-red-400', label: 'Alto risco', dot: 'bg-risk-red' },
}

export function categoryColor(category: string): string {
  return CATEGORY_STYLES[category]?.dot ?? 'bg-zinc-500'
}

export function categoryHex(category: string): string {
  switch (category) {
    case 'verde':
      return '#22c55e'
    case 'amarelo':
      return '#eab308'
    case 'vermelho':
      return '#dc2626'
    default:
      return '#71717a'
  }
}

export default function RiskBadge({ category, score }: { category: RiskCategory | string; score?: number }) {
  const style = CATEGORY_STYLES[category] ?? {
    bg: 'bg-zinc-800',
    text: 'text-zinc-300',
    label: category,
    dot: 'bg-zinc-500',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      {style.label}
      {score != null && <span className="opacity-80">· {score}</span>}
    </span>
  )
}
