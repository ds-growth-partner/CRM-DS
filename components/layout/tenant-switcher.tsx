'use client'

import { useAuth } from '@/providers/auth-provider'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { Eye, ChevronDown, Building2, ShieldCheck } from 'lucide-react'

// Selector de cuenta para super admins: permite "ver como" cualquier tenant.
// Solo se renderiza si el usuario es super admin y hay más de una cuenta.
export function TenantSwitcher() {
  const {
    isSuperAdmin,
    isImpersonating,
    availableTenants,
    activeTenantId,
    setActiveTenantId,
    ownTenant,
    tenant,
  } = useAuth()

  if (!isSuperAdmin || availableTenants.length <= 1) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer max-w-[220px]',
          isImpersonating
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15'
            : 'border-primary/30 bg-primary/8 text-primary hover:bg-primary/12'
        )}
        title="Ver como otra cuenta (super admin)"
      >
        {isImpersonating ? <Eye className="h-3 w-3 shrink-0" /> : <ShieldCheck className="h-3 w-3 shrink-0" />}
        <span className="text-muted-foreground/70 hidden sm:inline">Viendo como:</span>
        <span className="truncate">{tenant?.name ?? 'Selecciona cuenta'}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-1.5 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          Ver como cuenta
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={activeTenantId ?? ''}
          onValueChange={(id) => setActiveTenantId(id)}
        >
          {availableTenants.map((t) => (
            <DropdownMenuRadioItem key={t.id} value={t.id} className="text-sm gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate flex-1">{t.name}</span>
              {t.id === ownTenant?.id && (
                <span className="text-[9px] text-muted-foreground uppercase tracking-wide shrink-0">
                  Tuya
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
