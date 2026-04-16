import Link from 'next/link'
import { cn } from '@/lib/utils'

const SETTINGS_NAV = [
  { href: '/settings/general', label: 'General' },
  { href: '/settings/users', label: 'Usuarios' },
  { href: '/settings/tags', label: 'Etiquetas' },
  { href: '/settings/funnel', label: 'Embudo de ventas' },
  { href: '/settings/integrations', label: 'Integraciones' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 border-r border-border p-4 space-y-1">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 pb-2">Configuración</h2>
        {SETTINGS_NAV.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  )
}
