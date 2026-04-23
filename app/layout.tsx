import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
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
  title: 'TuContador CRM',
  description: 'CRM inteligente para TuContador — gestión de leads con WhatsApp e IA',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${jakarta.variable} h-full`}
    >
      <body className="h-full antialiased font-sans">
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
  )
}
