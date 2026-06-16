'use client'

import { useEffect, useRef } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { useAuth } from '@/providers/auth-provider'

/**
 * Plays a sound + shows a browser notification whenever an inbound WhatsApp
 * message arrives for the current tenant. Relies on Realtime being authenticated
 * with the Clerk JWT (see lib/supabase/client.ts) so RLS scopes events to the
 * tenant — we never get other tenants' messages.
 */
export function useNewMessageNotifier() {
  const { supabase } = useSupabase()
  const { tenant } = useAuth()
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Ask for notification permission once.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Unlock the AudioContext on the first user interaction (autoplay policy).
  useEffect(() => {
    function unlock() {
      try {
        if (!audioCtxRef.current) {
          const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          audioCtxRef.current = new Ctx()
        }
        audioCtxRef.current?.resume()
      } catch { /* ignore */ }
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!tenant) return

    const channel = supabase
      .channel(`notify-inbound-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const msg = payload.new as {
            direction: string
            content: string | null
            content_type: string
            conversation_id: string
          }
          if (msg.direction !== 'inbound') return
          playBeep()
          showNotification(msg)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, tenant?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function playBeep() {
    try {
      let ctx = audioCtxRef.current
      if (!ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        ctx = new Ctx()
        audioCtxRef.current = ctx
      }
      if (ctx.state === 'suspended') ctx.resume()

      const now = ctx.currentTime
      // Two short ascending tones — a soft "WhatsApp-like" chime.
      ;[880, 1175].forEach((freq, i) => {
        const osc = ctx!.createOscillator()
        const gain = ctx!.createGain()
        osc.connect(gain)
        gain.connect(ctx!.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        const t = now + i * 0.13
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
        osc.start(t)
        osc.stop(t + 0.13)
      })
    } catch { /* ignore */ }
  }

  function showNotification(msg: { content: string | null; content_type: string; conversation_id: string }) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    // Only nag with a system notification when the tab isn't focused.
    if (!document.hidden) return
    const body = msg.content?.trim() || `[${msg.content_type}]`
    try {
      new Notification('Nuevo mensaje de WhatsApp', {
        body,
        tag: msg.conversation_id,
        icon: '/favicon.ico',
      })
    } catch { /* ignore */ }
  }
}
