import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Server-side Supabase client using the service role key.
// Bypasses RLS — only use in trusted API routes and webhooks.
export function createAdminClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Server-side Supabase client with a Clerk JWT — respects RLS.
// Use in Server Components / API routes that have access to the Clerk token.
export async function createServerClient(clerkToken: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createSupabaseClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${clerkToken}` },
      },
    }
  )
}
