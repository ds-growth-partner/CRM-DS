import type { AIAction } from '@/lib/types/database'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sentence(s?: string | null): string {
  const t = (s ?? '').trim()
  return t && !UUID_RE.test(t) ? t : ''
}

/**
 * El agente n8n guarda en `ai_actions` con las columnas un poco invertidas:
 *  - action_type → la acción que ejecutó el bot (frase completa)
 *  - summary     → el contexto/disparador del usuario
 * Devolvemos un texto legible combinando ambos ("contexto → acción"),
 * ignorando valores que en realidad son UUIDs (filas mal formadas).
 */
export function aiActionText(a: Pick<AIAction, 'action_type' | 'summary'>): string {
  const action = sentence(a.action_type)
  const ctx = sentence(a.summary)
  if (action && ctx && action !== ctx) return `${ctx} → ${action}`
  return action || ctx || ''
}
