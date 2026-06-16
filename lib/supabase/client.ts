'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Browser Supabase client factory.
// Pass getToken from Clerk's useAuth() so the Clerk JWT is used for EVERY channel:
// REST, Storage AND the Realtime websocket. Using the `accessToken` option (instead
// of only overriding fetch) is what makes Realtime authenticate as the logged-in
// user — otherwise the socket connects as `anon`, RLS blocks it, and no live events
// arrive (so the UI only updates on reload).
export function createClient(getToken?: () => Promise<string | null>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      accessToken: getToken ? async () => (await getToken()) ?? null : undefined,
    }
  )
}
