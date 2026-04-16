'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useWindow24h } from '@/hooks/use-window-24h'
import { useSupabase } from '@/providers/supabase-provider'

interface ComposerProps {
  conversationId: string
  contactId: string
  waId: string
  chatwootConversationId?: number | null
  lastIncomingAt: string | null
  onOptimisticMessage?: (content: string) => string
  onMessageSent?: () => void
}

export function Composer({
  conversationId,
  contactId,
  waId,
  chatwootConversationId,
  lastIncomingAt,
  onOptimisticMessage,
  onMessageSent,
}: ComposerProps) {
  const { supabase } = useSupabase()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { isOpen: windowOpen } = useWindow24h(lastIncomingAt)

  async function handleSend() {
    const content = text.trim()
    if (!content || sending) return

    setSending(true)
    onOptimisticMessage?.(content)
    setText('')

    try {
      // Get tenant_id from the conversation
      const { data: convData } = await supabase
        .from('conversations')
        .select('tenant_id')
        .eq('id', conversationId)
        .single()

      if (!convData) throw new Error('Conversación no encontrada')

      // Insert message directly into Supabase
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          tenant_id: convData.tenant_id,
          conversation_id: conversationId,
          contact_id: contactId,
          content,
          content_type: 'text',
          direction: 'outbound',
          sender_type: 'agent',
          delivery_status: 'sent',
        })

      if (msgError) throw msgError

      // Update conversation metadata
      await supabase
        .from('conversations')
        .update({
          last_message_preview: content,
          last_message_at: new Date().toISOString(),
          last_message_direction: 'outbound',
          unread_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)

      // Update contact last_contacted_at
      await supabase
        .from('contacts')
        .update({
          last_contacted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)

      onMessageSent?.()
    } catch {
      toast.error('Error al enviar mensaje')
      setText(content)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!windowOpen) {
    return (
      <div className="border-t border-border p-4 text-center text-sm text-muted-foreground">
        La ventana de 24h ha expirado.{' '}
        <button className="text-primary underline underline-offset-2">Enviar plantilla HSM</button>
      </div>
    )
  }

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" className="shrink-0 mb-0.5">
          <Paperclip className="h-5 w-5" />
        </Button>
        <Textarea
          ref={textareaRef}
          placeholder="Escribe un mensaje..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none py-2"
        />
        <Button
          size="icon"
          className="shrink-0 mb-0.5"
          onClick={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

