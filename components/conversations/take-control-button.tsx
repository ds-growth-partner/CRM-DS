'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Bot, User, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useSupabase } from '@/providers/supabase-provider'

interface TakeControlButtonProps {
  conversationId: string
  contactId: string
  aiActive: boolean
  chatwootConversationId?: number | null
  onToggle?: (newAiActive: boolean) => void
}

export function TakeControlButton({
  conversationId,
  contactId,
  aiActive,
  chatwootConversationId,
  onToggle,
}: TakeControlButtonProps) {
  const { supabase } = useSupabase()
  const [loading, setLoading] = useState(false)
  const [localAiActive, setLocalAiActive] = useState(aiActive)

  async function handleToggle() {
    setLoading(true)
    const newAiActive = !localAiActive

    try {
      // Update conversation ai_active directly in Supabase
      const { error: convError } = await supabase
        .from('conversations')
        .update({ ai_active: newAiActive, updated_at: new Date().toISOString() })
        .eq('id', conversationId)

      if (convError) throw convError

      // Also update the contact's ai_active flag
      const { error: contactError } = await supabase
        .from('contacts')
        .update({ ai_active: newAiActive, updated_at: new Date().toISOString() })
        .eq('id', contactId)

      if (contactError) throw contactError

      // Log the intervention in AI actions for transparency
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
      variant={localAiActive ? 'outline' : 'default'}
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className="gap-2"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : localAiActive ? (
        <>
          <User className="h-4 w-4" />
          Tomar Control
        </>
      ) : (
        <>
          <Bot className="h-4 w-4" />
          Devolver a IA
        </>
      )}
    </Button>
  )
}

