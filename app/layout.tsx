import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import { SupabaseProvider } from '@/providers/supabase-provider'
import { AuthProvider } from '@/providers/auth-provider'
import { ThemeProvider } from '@/providers/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

const jakarta = Plus_Jakarta_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DS CRM',
  description: 'Plataforma CRM multi-tenant con WhatsApp e IA',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/conversations"
      signUpFallbackRedirectUrl="/onboarding"
    >
      <html
        lang="es"
        suppressHydrationWarning
        className={`${jakarta.variable} h-full`}
      >
        <body className="h-full overflow-hidden antialiased font-sans overscroll-none">
          <ThemeProvider>
            <SupabaseProvider>
              <AuthProvider>
                <TooltipProvider>
                  {children}
                  <Toaster richColors position="top-right" />
                </TooltipProvider>
              </AuthProvider>
            </SupabaseProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
