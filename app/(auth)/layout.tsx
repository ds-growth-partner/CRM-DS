export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Glow orb — top left */}
      <div
        className="pointer-events-none absolute -top-64 -left-64 h-[500px] w-[500px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, oklch(0.62 0.24 264) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      {/* Glow orb — bottom right */}
      <div
        className="pointer-events-none absolute -bottom-64 -right-64 h-[500px] w-[500px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, oklch(0.62 0.24 293) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo + brand */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white text-xl font-bold mb-5 glow-primary"
            style={{ background: 'linear-gradient(135deg, oklch(0.62 0.24 264), oklch(0.58 0.24 285))' }}
          >
            DS
          </div>
          <h1 className="text-2xl font-bold gradient-text">DS CRM</h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Plataforma inteligente de gestión de clientes
          </p>
        </div>

        {/* Clerk components render here */}
        <div className="flex justify-center">
          {children}
        </div>
      </div>
    </div>
  )
}
