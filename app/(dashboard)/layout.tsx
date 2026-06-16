import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { MobileBackdrop } from '@/components/layout/mobile-backdrop'
import { RealtimeNotifier } from '@/components/shared/realtime-notifier'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sonido + notificación del navegador en mensajes entrantes */}
      <RealtimeNotifier />

      {/* Overlay backdrop para cerrar sidebar en mobile */}
      <MobileBackdrop />

      <Sidebar />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 relative overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
