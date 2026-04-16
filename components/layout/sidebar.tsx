'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { useAuth } from '@/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  MessageSquare,
  Users,
  Calendar,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  LogOut,
} from 'lucide-react'
import { useSupabase } from '@/providers/supabase-provider'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/conversations', label: 'Conversaciones', icon: MessageSquare },
  { href: '/contacts', label: 'Contactos', icon: Users },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/templates', label: 'Plantillas', icon: FileText },
  { href: '/reports', label: 'Reportes', icon: BarChart3 },
]

const BOTTOM_ITEMS = [
  { href: '/settings', label: 'Configuración', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { user, tenant } = useAuth()
  const { supabase } = useSupabase()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function NavItem({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
    const isActive = pathname.startsWith(href)

    if (sidebarCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
          )}>
            <Icon className="h-5 w-5" />
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {label}
      </Link>
    )
  }

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-border bg-sidebar transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-16 items-center border-b border-border px-4',
        sidebarCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              TC
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">TuContador</p>
              <p className="text-xs text-muted-foreground truncate max-w-[120px]">{tenant?.name ?? 'CRM'}</p>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            TC
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* AI Badge */}
      {!sidebarCollapsed && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
            <Bot className="h-3.5 w-3.5" />
            <span>IA Activa</span>
            <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn(
        'flex-1 space-y-1 py-4',
        sidebarCollapsed ? 'px-3' : 'px-3'
      )}>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Bottom items */}
      <div className={cn(
        'border-t border-border py-4 space-y-1',
        sidebarCollapsed ? 'px-3' : 'px-3'
      )}>
        {BOTTOM_ITEMS.map(item => (
          <NavItem key={item.href} {...item} />
        ))}

        {/* User info */}
        <div className={cn(
          'mt-3 flex items-center gap-3 rounded-lg px-3 py-2',
          sidebarCollapsed ? 'justify-center' : ''
        )}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
            {user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{user?.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger
              className="h-7 w-7 shrink-0 text-muted-foreground inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right">Cerrar sesión</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}
