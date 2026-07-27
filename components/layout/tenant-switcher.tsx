'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/providers/auth-provider'
import { cn } from '@/lib/utils'
import { Eye, ChevronDown, Building2, ShieldCheck, Check } from 'lucide-react'

// Selector de cuenta para super admins: permite "ver como" cualquier tenant.
// Solo se renderiza si el usuario es super admin y hay más de una cuenta.
//
// Se implementa como dropdown propio (botón + menú absoluto + click-afuera) en
// vez de con el Menu de Base UI, que en la v1.4.0 lanzaba el error #31.
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
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!isSuperAdmin || availableTenants.length <= 1) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Ver como otra cuenta (super admin)"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer max-w-[220px]',
          isImpersonating
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15'
            : 'border-primary/30 bg-primary/8 text-primary hover:bg-primary/12'
        )}
      >
        {isImpersonating ? <Eye className="h-3 w-3 shrink-0" /> : <ShieldCheck className="h-3 w-3 shrink-0" />}
        <span className="text-muted-foreground/70 hidden sm:inline">Viendo como:</span>
        <span className="truncate">{tenant?.name ?? 'Selecciona cuenta'}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-64 bg-popover border border-border rounded-xl shadow-xl overflow-hidden animate-slide-up">
          <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Ver como cuenta
          </div>
          <div className="py-1 max-h-72 overflow-y-auto">
            {availableTenants.map((t) => {
              const isActive = t.id === activeTenantId
              return (
                <button
                  key={t.id}
                  onClick={() => { setActiveTenantId(t.id); setOpen(false) }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors cursor-pointer',
                    isActive ? 'bg-primary/8 text-primary font-medium' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate flex-1">{t.name}</span>
                  {t.id === ownTenant?.id && (
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wide shrink-0">Tuya</span>
                  )}
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
