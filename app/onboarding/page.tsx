'use client'

import { useEffect } from 'react'
import { useUser, useOrganizationList, CreateOrganization } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/auth-provider'

export default function OnboardingPage() {
  const { user, isLoaded } = useUser()
  const { userMemberships } = useOrganizationList({ userMemberships: true })
  const { tenant } = useAuth()
  const router = useRouter()

  // If user already has an org and tenant in DB → go to app
  useEffect(() => {
    if (!isLoaded) return
    if (tenant) {
      router.replace('/conversations')
    }
  }, [tenant, isLoaded, router])

  if (!isLoaded) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Glow orbs */}
      <div
        className="pointer-events-none absolute -top-64 -left-64 h-[500px] w-[500px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, oklch(0.62 0.24 264) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-64 -right-64 h-[500px] w-[500px] rounded-full opacity-15"
        style={{ background: 'radial-gradient(circle, oklch(0.62 0.24 293) 0%, transparent 70%)', filter: 'blur(80px)' }}
      />

      <div className="w-full max-w-lg relative z-10 space-y-8">
        {/* Header */}
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white text-xl font-bold mb-5"
            style={{ background: 'linear-gradient(135deg, oklch(0.62 0.24 264), oklch(0.58 0.24 285))' }}
          >
            DS
          </div>
          <h1 className="text-2xl font-bold text-foreground">Crea tu organización</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Hola {user?.firstName}, configura tu espacio de trabajo en DS CRM.
          </p>
        </div>

        {/* Clerk CreateOrganization component */}
        <div className="flex justify-center">
          <CreateOrganization afterCreateOrganizationUrl="/conversations" />
        </div>
      </div>
    </div>
  )
}
