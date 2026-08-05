'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Bot, User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSupabase } from '@/providers/supabase-provider'

interface TakeControlButtonProps {
  conversationId: string
  contactId: string
  aiActive: boolean
  onToggle?: (newAiActive: boolean) => void
}

export function TakeControlButton({
  conversationId,
  contactId,
  aiActive,
  onToggle,
}: TakeControlButtonProps) {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [localAiActive, setLocalAiActive] = useState(aiActive)

  // Mantener el estado del botón en sync con la fuente de verdad (la prop, que
  // viene de la BD y se actualiza en tiempo real). Sin esto, el botón se queda
  // con el valor inicial y su etiqueta puede contradecir a la base de datos.
  useEffect(() => {
    setLocalAiActive(aiActive)
  }, [aiActive])

  async function handleToggle() {
    setLoading(true)
    const newAiActive = !localAiActive

    try {
      const { error: convError } = await supabase
        .from('conversations')
        .update({ ai_active: newAiActive, updated_at: new Date().toISOString() })
        .eq('id', conversationId)

      if (convError) throw convError

      const { error: contactError } = await supabase
        .from('contacts')
        .update({ ai_active: newAiActive, updated_at: new Date().toISOString() })
        .eq('id', contactId)

      if (contactError) throw contactError

      const { data: convData } = await supabase
        .from('conversations')
        .select('tenant_id')
        .eq('id', conversationId)
        .single()

      if (convData) {
        await supabase
          .from('ai_actions')
          .insert({
            tenant_id: convData.tenant_id,
            conversation_id: conversationId,
            contact_id: contactId,
            action_type: newAiActive ? 'release_control' : 'take_control',
            summary: newAiActive ? 'Control devuelto a la IA' : 'Agente humano tomó control',
            reasoning: newAiActive
              ? 'El agente consideró que la IA puede continuar la conversación.'
              : 'El agente intervino para manejar la solicitud manualmente.',
            status: 'success'
          })
      }

      // Notificar a n8n en tiempo real (best-effort): que sepa de inmediato si
      // debe responder o no. La fuente de verdad sigue siendo el flag ai_active
      // en la BD; si n8n no está configurado, esto falla en silencio sin romper
      // el toggle.
      fetch(newAiActive ? '/api/webhooks/n8n/release-control' : '/api/webhooks/n8n/take-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          contact_id: contactId,
          ai_active: newAiActive,
        }),
      }).catch(() => {})

      setLocalAiActive(newAiActive)
      onToggle?.(newAiActive)
      toast.success(newAiActive ? 'Control devuelto a la IA' : 'Control tomado por humano')
    } catch {
      toast.error('No se pudo cambiar el control')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={localAiActive ? 'outline' : 'secondary'}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="gap-1.5 h-7 text-xs border-border/60 hover:border-primary/40 bg-transparent cursor-pointer"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : localAiActive ? (
        <>
          <User className="h-3.5 w-3.5" />
          Tomar Control
        </>
      ) : (
        <>
          <Bot className="h-3.5 w-3.5" />
          Devolver a IA
        </>
      )}
    </Button>
  )
}
