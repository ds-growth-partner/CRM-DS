'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Paperclip, Smile, Loader2, FileText, X, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useWindow24h } from '@/hooks/use-window-24h'
import { useSupabase } from '@/providers/supabase-provider'
import { useCannedResponses } from '@/hooks/use-canned-responses'
import { useCustomFieldDefinitions } from '@/hooks/use-custom-field-definitions'
import { EmojiPicker } from '@/components/ui/emoji-picker'
import type { ContactForConversation } from '@/lib/types/database'

interface ComposerProps {
  conversationId: string
  contactId: string
  waId: string | null
  lastIncomingAt: string | null
  contact?: ContactForConversation | null
  onOptimisticMessage?: (content: string) => void
  onMessageSent?: () => void
}

// Reemplaza {{field_key}} con el valor del contacto
function resolveVariables(
  text: string,
  contact: ContactForConversation | null | undefined,
  customValues: Record<string, unknown>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const builtIn: Record<string, string | null | undefined> = {
      first_name: contact?.first_name,
      last_name: contact?.last_name,
      full_name: contact ? `${contact.first_name} ${contact.last_name ?? ''}`.trim() : undefined,
      phone: contact?.phone,
      email: contact?.email,
      company: contact?.company,
      city: contact?.city,
    }
    if (key in builtIn) return builtIn[key] ?? `{{${key}}}`
    const custom = customValues[key]
    return custom !== undefined && custom !== null ? String(custom) : `{{${key}}}`
  })
}

export function Composer({
  conversationId,
  contactId,
  waId,
  lastIncomingAt,
  contact,
  onOptimisticMessage,
  onMessageSent,
}: ComposerProps) {
  const { supabase } = useSupabase()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showCanned, setShowCanned] = useState(false)
  const [cannedQuery, setCannedQuery] = useState('')
  const [showVarDropdown, setShowVarDropdown] = useState(false)
  const [varQuery, setVarQuery] = useState('')
  const [attachments, setAttachments] = useState<{ file: File; previewUrl?: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { isOpen: windowOpen } = useWindow24h(lastIncomingAt)
  const { search: searchCanned } = useCannedResponses()
  const { fields: customFieldDefs } = useCustomFieldDefinitions()

  const customValues: Record<string, unknown> = contact?.custom_fields
    ? (contact.custom_fields as Record<string, unknown>)
    : {}

  // Detectar "/" para canned responses y "{{" para variables
  function handleTextChange(val: string) {
    setText(val)

    // Canned responses: línea que empieza con "/"
    const lastLine = val.split('\n').pop() ?? ''
    if (lastLine.startsWith('/')) {
      setCannedQuery(lastLine.slice(1))
      setShowCanned(true)
      setShowVarDropdown(false)
      return
    }
    setShowCanned(false)

    // Variables: detectar "{{" sin cerrar
    const match = val.match(/\{\{([^}]*)$/)
    if (match) {
      setVarQuery(match[1])
      setShowVarDropdown(true)
      return
    }
    setShowVarDropdown(false)
  }

  function insertCannedResponse(content: string) {
    // Reemplaza la línea "/" con el contenido
    const lines = text.split('\n')
    lines[lines.length - 1] = content
    setText(lines.join('\n'))
    setShowCanned(false)
    textareaRef.current?.focus()
  }

  function insertVariable(key: string) {
    // Reemplaza el "{{query" incompleto con "{{key}}"
    const resolved = text.replace(/\{\{([^}]*)$/, `{{${key}}}`)
    setText(resolved)
    setShowVarDropdown(false)
    textareaRef.current?.focus()
  }

  const ALL_VARIABLES = [
    { key: 'first_name', label: 'Nombre' },
    { key: 'last_name', label: 'Apellido' },
    { key: 'full_name', label: 'Nombre completo' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'email', label: 'Correo' },
    { key: 'company', label: 'Empresa' },
    { key: 'city', label: 'Ciudad' },
    ...customFieldDefs.map(f => ({ key: f.field_key, label: f.label })),
  ]

  const filteredVars = ALL_VARIABLES.filter(v =>
    v.key.toLowerCase().includes(varQuery.toLowerCase()) ||
    v.label.toLowerCase().includes(varQuery.toLowerCase())
  )

  const cannedResults = searchCanned(cannedQuery)

  async function uploadFile(file: File): Promise<string | null> {
    const { data: convData } = await supabase
      .from('conversations').select('tenant_id').eq('id', conversationId).single()
    if (!convData) return null

    const ext = file.name.split('.').pop()
    const path = `${convData.tenant_id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file)
    if (error) { toast.error('Error al subir archivo'); return null }
    const { data } = supabase.storage.from('media').getPublicUrl(path)
    return data.publicUrl
  }

  function getContentType(file: File): 'image' | 'audio' | 'video' | 'document' {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('audio/')) return 'audio'
    if (file.type.startsWith('video/')) return 'video'
    return 'document'
  }

  async function handleSend() {
    const hasText = text.trim().length > 0
    const hasFiles = attachments.length > 0
    if ((!hasText && !hasFiles) || sending) return

    setSending(true)
    const resolved = hasText ? resolveVariables(text.trim(), contact, customValues) : ''
    if (hasText) onOptimisticMessage?.(resolved)
    setText('')
    setAttachments([])

    try {
      const now = new Date().toISOString()

      // Get tenant_id from conversation
      const { data: convData } = await supabase
        .from('conversations').select('tenant_id').eq('id', conversationId).single()
      if (!convData) throw new Error('Conversación no encontrada')
      const tenantId = convData.tenant_id

      // ── Text message ────────────────────────────────────────────────────
      if (hasText) {
        // Update conversation preview locally
        await supabase.from('conversations').update({
          last_message_preview: resolved.slice(0, 100),
          last_message_at: now,
          last_message_direction: 'outbound',
          unread_count: 0,
          updated_at: now,
        }).eq('id', conversationId)

        // Send to n8n — n8n sends via WhatsApp API and writes to messages table
        if (waId) {
          await fetch('/api/webhooks/n8n/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wa_id: waId,
              message_type: 'text',
              message: resolved,
              contact: contact ? {
                id: contact.id,
                first_name: contact.first_name,
                last_name: contact.last_name,
                phone: contact.phone,
                email: contact.email,
                wa_id: contact.wa_id,
                company: contact.company,
                custom_fields: contact.custom_fields,
              } : null,
              conversation_id: conversationId,
            }),
          })
        }
      }

      // ── File attachments ────────────────────────────────────────────────
      if (hasFiles) {
        setUploading(true)
        for (const { file } of attachments) {
          const mediaUrl = await uploadFile(file)
          if (!mediaUrl) continue

          const ct = getContentType(file)

          // Update conversation preview locally
          await supabase.from('conversations').update({
            last_message_preview: `[${ct}] ${file.name}`,
            last_message_at: now,
            last_message_direction: 'outbound',
            unread_count: 0,
            updated_at: now,
          }).eq('id', conversationId)

          // Send to n8n — n8n sends via WhatsApp API and writes to messages table
          if (waId) {
            await fetch('/api/webhooks/n8n/send-message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wa_id: waId,
                message_type: ct,
                media_url: mediaUrl,
                media_filename: file.name,
                media_mime_type: file.type,
                message: `[${ct}] ${file.name}`,
                contact: contact ? {
                  id: contact.id,
                  first_name: contact.first_name,
                  last_name: contact.last_name,
                  phone: contact.phone,
                  email: contact.email,
                  wa_id: contact.wa_id,
                  company: contact.company,
                  custom_fields: contact.custom_fields,
                } : null,
                conversation_id: conversationId,
              }),
            })
          }
        }
        setUploading(false)
      }

      // ── Update contact last_contacted_at ────────────────────────────────
      await supabase.from('contacts').update({
        last_contacted_at: now,
        updated_at: now,
      }).eq('id', contactId)

      onMessageSent?.()
    } catch {
      toast.error('Error al enviar mensaje')
      if (hasText) setText(text)
    } finally {
      setSending(false)
      setUploading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (showCanned || showVarDropdown) {
      if (e.key === 'Escape') {
        setShowCanned(false)
        setShowVarDropdown(false)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const newAttachments = files.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    setAttachments(prev => [...prev, ...newAttachments])
    e.target.value = ''
  }

  function removeAttachment(index: number) {
    setAttachments(prev => {
      const item = prev[index]
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  if (!windowOpen) {
    return (
      <div className="border-t border-border bg-destructive/5 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Ventana de 24h expirada.{' '}
          <button className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors cursor-pointer">
            Enviar plantilla HSM
          </button>
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-border bg-background/50 backdrop-blur-sm">
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap px-3 pt-2.5">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              {att.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={att.previewUrl} alt="" className="h-14 w-14 object-cover rounded-xl border border-border" />
              ) : (
                <div className="flex items-center gap-1.5 h-10 px-2.5 bg-muted/60 rounded-xl border border-border text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="max-w-[100px] truncate">{att.file.name}</span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(i)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Canned responses dropdown */}
      {showCanned && cannedResults.length > 0 && (
        <div className="mx-3 mb-1 border border-border rounded-xl bg-popover shadow-xl overflow-hidden max-h-48 overflow-y-auto animate-slide-up">
          <p className="px-3 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border">
            Respuestas rápidas
          </p>
          {cannedResults.map(r => (
            <button
              key={r.id}
              onMouseDown={e => { e.preventDefault(); insertCannedResponse(r.content) }}
              className="flex items-start gap-3 w-full px-3 py-2 hover:bg-muted text-left transition-colors"
            >
              <span className="text-[10px] font-mono text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded-md shrink-0">{r.shortcut}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground">{r.title}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.content}</p>
              </div>
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />
            </button>
          ))}
        </div>
      )}

      {/* Variable dropdown */}
      {showVarDropdown && filteredVars.length > 0 && (
        <div className="mx-3 mb-1 border border-border rounded-xl bg-popover shadow-xl overflow-hidden max-h-40 overflow-y-auto animate-slide-up">
          <p className="px-3 py-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-b border-border">
            Campos disponibles
          </p>
          {filteredVars.map(v => (
            <button
              key={v.key}
              onMouseDown={e => { e.preventDefault(); insertVariable(v.key) }}
              className="flex items-center gap-3 w-full px-3 py-1.5 hover:bg-muted text-left text-xs transition-colors"
            >
              <code className="text-[11px] font-mono text-primary bg-primary/8 px-1.5 py-0.5 rounded border border-primary/20">{`{{${v.key}}}`}</code>
              <span className="text-muted-foreground">{v.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-1.5 px-2.5 py-2.5">
        {/* Emoji */}
        <div className="relative shrink-0">
          <button
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
              showEmoji
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            onClick={() => { setShowEmoji(v => !v); setShowCanned(false); setShowVarDropdown(false) }}
          >
            <Smile className="h-4 w-4" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-10 left-0 z-50">
              <EmojiPicker onSelect={emoji => {
                setText(prev => prev + emoji)
                setShowEmoji(false)
                textareaRef.current?.focus()
              }} />
            </div>
          )}
        </div>

        {/* File attach */}
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Textarea */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            placeholder='Mensaje... ("/" para atajos, "{{" para variables)'
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="min-h-[36px] max-h-[140px] resize-none py-2 text-sm bg-muted/40 border-border/60 focus:border-primary/40 rounded-xl transition-colors"
          />
        </div>

        {/* Send */}
        <Button
          size="icon"
          className="h-8 w-8 shrink-0 rounded-xl cursor-pointer"
          style={{
            background: (!text.trim() && attachments.length === 0) || sending || uploading
              ? undefined
              : 'linear-gradient(135deg, oklch(0.62 0.24 264), oklch(0.58 0.24 285))',
          }}
          onClick={handleSend}
          disabled={(!text.trim() && attachments.length === 0) || sending || uploading}
        >
          {sending || uploading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Send className="h-3.5 w-3.5" />
          }
        </Button>
      </div>

      {/* Hint */}
      <p className="px-3 pb-2 text-[10px] text-muted-foreground/50">
        Enter para enviar · Shift+Enter nueva línea · <span className="font-mono text-muted-foreground/70">/</span> atajos · <span className="font-mono text-muted-foreground/70">{'{{'}  </span> variables
      </p>
    </div>
  )
}
