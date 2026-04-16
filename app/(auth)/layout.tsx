export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary text-primary-foreground text-xl font-bold mb-4">
            TC
          </div>
          <h1 className="text-2xl font-bold text-foreground">TuContador CRM</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Plataforma inteligente de gestión de clientes
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
