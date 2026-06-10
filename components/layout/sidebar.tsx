'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/ui-store'
import { useAuth } from '@/providers/auth-provider'
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
  LogOut,
  Zap,
  X,
  Send,
} from 'lucide-react'
import { useSupabase } from '@/providers/supabase-provider'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/conversations', label: 'Conversaciones', icon: MessageSquare },
  { href: '/contacts',      label: 'Contactos',      icon: Users },
  { href: '/calendar',      label: 'Calendario',     icon: Calendar },
  { href: '/templates',      label: 'Plantillas',     icon: FileText },
  { href: '/campaigns',     label: 'Campañas',       icon: Send },
  { href: '/reports',       label: 'Reportes',       icon: BarChart3 },
]

const BOTTOM_ITEMS = [
  { href: '/settings', label: 'Configuración', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, toggleSidebar, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()
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
          <TooltipTrigger render={
            <Link
              href={href}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer',
                isActive
                  ? 'nav-active-bar text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            />
          }>
            <Icon className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Link
        href={href}
        className={cn(
          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer',
          isActive
            ? 'nav-active-bar text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-0.5'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate flex-1">{label}</span>
        {isActive && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 opacity-80" />
        )}
      </Link>
    )
  }

  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() ?? 'U'

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-border transition-all duration-300 bg-sidebar',
        // Desktop: collapsible
        sidebarCollapsed ? 'w-[68px]' : 'w-[220px]',
        // Mobile: fixed overlay, oculto por defecto
        'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[220px]',
        !mobileSidebarOpen && 'max-md:hidden',
      )}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Logo */}
      <div className={cn(
        'flex h-14 items-center border-b border-border px-3 gap-2',
        sidebarCollapsed ? 'justify-center' : 'justify-between'
      )}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white glow-sm"
              style={{ background: 'linear-gradient(135deg, oklch(0.62 0.24 264), oklch(0.58 0.24 293))' }}
            >
              TC
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground leading-tight">DS CRM</p>
              <p className="text-[10px] text-muted-foreground truncate">{tenant?.name ?? 'CRM'}</p>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold text-white glow-sm"
            style={{ background: 'linear-gradient(135deg, oklch(0.62 0.24 264), oklch(0.58 0.24 293))' }}
          >
            TC
          </div>
        )}
        {/* Mobile close button */}
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {/* Desktop collapse button */}
        <button
          onClick={toggleSidebar}
          className={cn(
            'hidden md:flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0 cursor-pointer',
            sidebarCollapsed && 'md:hidden'
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="absolute left-[68px] top-4 flex h-5 w-5 items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground shadow-sm z-10 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* AI Badge */}
      {!sidebarCollapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1.5 text-xs text-emerald-400">
            <Zap className="h-3 w-3 shrink-0" />
            <span className="font-semibold">IA Activa</span>
            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          </div>
        </div>
      )}
      {sidebarCollapsed && (
        <div className="flex justify-center pt-3 pb-1">
          <Tooltip>
            <TooltipTrigger render={
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 cursor-default"
              />
            }>
              <Zap className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="right">IA Activa</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn(
        'flex-1 space-y-0.5 py-3',
        sidebarCollapsed ? 'px-2 flex flex-col items-center' : 'px-2'
      )}>
        {NAV_ITEMS.map(item => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Divider */}
      <div className="mx-3 h-px bg-border" />

      {/* Bottom items */}
      <div className={cn(
        'py-3 space-y-0.5',
        sidebarCollapsed ? 'px-2 flex flex-col items-center' : 'px-2'
      )}>
        {BOTTOM_ITEMS.map(item => (
          <NavItem key={item.href} {...item} />
        ))}

        {/* User row */}
        <div className={cn(
          'mt-2 flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors hover:bg-accent',
          sidebarCollapsed ? 'justify-center' : ''
        )}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold ring-1 ring-primary/25">
            {userInitial}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate leading-tight">{user?.full_name}</p>
              <p className="text-[10px] text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger render={
              <button
                onClick={handleLogout}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              />
            }>
              <LogOut className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent side="right">Cerrar sesión</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  )
}
