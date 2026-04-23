'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Settings2,
  Users2,
  Tags,
  Layers,
  SquareCode,
  MessageSquareDashed,
  Plug,
} from 'lucide-react'

const SETTINGS_NAV = [
  { href: '/settings/general',          label: 'General',               icon: Settings2 },
  { href: '/settings/users',            label: 'Usuarios',              icon: Users2 },
  { href: '/settings/tags',             label: 'Etiquetas',             icon: Tags },
  { href: '/settings/funnel',           label: 'Embudo de ventas',      icon: Layers },
  { href: '/settings/custom-fields',    label: 'Campos personalizados', icon: SquareCode },
  { href: '/settings/canned-responses', label: 'Respuestas rápidas',    icon: MessageSquareDashed },
  { href: '/settings/integrations',     label: 'Integraciones',         icon: Plug },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full">
      <nav className="w-52 shrink-0 border-r border-border bg-sidebar p-3 space-y-0.5">
        <p className="section-label px-3 pb-2 pt-1 block">Configuración</p>
        {SETTINGS_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 cursor-pointer',
                isActive
                  ? 'nav-active-bar text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="flex-1 overflow-auto p-6 bg-background">{children}</div>
    </div>
  )
}
