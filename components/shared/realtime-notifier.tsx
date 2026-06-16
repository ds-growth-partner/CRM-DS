'use client'

import { useNewMessageNotifier } from '@/hooks/use-new-message-notifier'

/** Mount once in the dashboard layout: plays a sound + browser notification on inbound messages. */
export function RealtimeNotifier() {
  useNewMessageNotifier()
  return null
}
