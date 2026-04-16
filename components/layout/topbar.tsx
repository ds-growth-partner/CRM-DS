'use client'

import { useAuth } from '@/providers/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Bell } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'
import { Badge } from '@/components/ui/badge'

export function Topbar() {
  const { user, tenant } = useAuth()

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-background px-6">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contacto, conversación..."
          className="pl-9 h-9 bg-muted/50"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>
        {tenant && (
          <Badge variant="outline" className="text-xs">
            {tenant.plan}
          </Badge>
        )}
      </div>
    </header>
  )
}
