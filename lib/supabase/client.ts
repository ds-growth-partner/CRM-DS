'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Browser Supabase client factory.
// Pass getToken from Clerk's useAuth() to inject the Clerk JWT on every request.
export function createClient(getToken?: () => Promise<string | null>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: async (url, options = {}) => {
          const token = getToken ? await getToken() : null
          const headers = new Headers(options.headers)
          if (token) headers.set('Authorization', `Bearer ${token}`)
          return fetch(url, { ...options, headers })
        },
      },
    }
  )
}
