'use client'

import { useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Mail, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const { supabase } = useSupabase()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
      toast.success('Enlace enviado. Revisa tu correo.')
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/25">
          <Mail className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Revisa tu correo</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enviamos un enlace de acceso a{' '}
            <span className="text-foreground font-medium">{email}</span>.
            Haz clic en él para iniciar sesión.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full border-border/60 hover:border-primary/40 bg-transparent cursor-pointer"
          onClick={() => setSent(false)}
        >
          Usar otro correo
        </Button>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <h2 className="text-lg font-semibold text-foreground">Iniciar sesión</h2>
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          Ingresa tu correo y te enviaremos un enlace de acceso seguro.
        </p>
      </div>

      <form onSubmit={handleMagicLink} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Correo electrónico
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@empresa.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus
            className="h-10 bg-muted/40 border-border/60 focus:border-primary/50 transition-colors"
          />
        </div>
        <Button
          type="submit"
          className="w-full h-10 font-semibold cursor-pointer"
          style={{
            background: loading ? undefined : 'linear-gradient(135deg, oklch(0.62 0.24 264), oklch(0.58 0.24 285))',
          }}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Mail className="w-4 h-4 mr-2" />
          )}
          Enviar enlace de acceso
        </Button>
      </form>
    </div>
  )
}
