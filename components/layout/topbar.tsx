'use client'

import { useAuth } from '@/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Bell, Menu } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { useUIStore } from '@/stores/ui-store'

export function Topbar() {
  const { tenant } = useAuth()
  const { toggleMobileSidebar } = useUIStore()

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-md px-4 shrink-0">
      {/* Hamburger — solo en mobile */}
      <button
        onClick={toggleMobileSidebar}
        className="md:hidden flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar contacto, conversación..."
          className="pl-9 h-8 bg-muted/50 border-transparent focus:border-primary/40 text-sm transition-colors"
        />
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>
        {tenant && (
          <span className="hidden sm:inline-flex items-center rounded-full border border-primary/30 bg-primary/8 px-2.5 py-0.5 text-[11px] font-semibold text-primary capitalize">
            {tenant.plan}
          </span>
        )}
      </div>
    </header>
  )
}
