'use client'

import { useEffect, useState } from 'react'
import { useSupabase } from '@/providers/supabase-provider'
import type { DailyMetrics } from '@/lib/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { MessageSquare, Users, Bot, TrendingUp, Calendar, Zap } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'

function KPICard({ title, value, icon: Icon, description, color = 'text-foreground' }: {
  title: string
  value: string | number
  icon: React.ElementType
  description?: string
  color?: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  )
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function ReportsPage() {
  const { supabase } = useSupabase()
  const [metrics, setMetrics] = useState<DailyMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [contactCount, setContactCount] = useState(0)
  const [stageStats, setStageStats] = useState<{ name: string; count: number }[]>([])

  useEffect(() => {
    const from = format(subDays(new Date(), 30), 'yyyy-MM-dd')
    Promise.all([
      supabase
        .from('daily_metrics')
        .select('*')
        .gte('date', from)
        .order('date'),
      supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('contacts')
        .select('funnel_stage:funnel_stages(name)')
        .not('funnel_stage_id', 'is', null),
    ]).then(([{ data: metricsData }, { count }, { data: contactsWithStage }]) => {
      setMetrics(metricsData ?? [])
      setContactCount(count ?? 0)

      // Aggregate stages
      const stageCounts: Record<string, number> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(contactsWithStage ?? []).forEach((c: any) => {
        const name = c.funnel_stage?.name ?? 'Sin etapa'
        stageCounts[name] = (stageCounts[name] ?? 0) + 1
      })
      setStageStats(Object.entries(stageCounts).map(([name, count]) => ({ name, count })))
      setLoading(false)
    })
  }, [supabase])

  const totalMessages = metrics.reduce((a, m) => a + m.messages_inbound + m.messages_outbound, 0)
  const totalConversations = metrics.reduce((a, m) => a + m.conversations_new, 0)
  const totalLeadsWon = metrics.reduce((a, m) => a + m.leads_won, 0)
  const botMessages = metrics.reduce((a, m) => a + m.messages_by_bot, 0)
  const botRate = totalMessages > 0 ? Math.round((botMessages / totalMessages) * 100) : 0

  const chartData = metrics.map(m => ({
    date: format(new Date(m.date), 'dd/MM', { locale: es }),
    entrantes: m.messages_inbound,
    salientes: m.messages_outbound,
    bot: m.messages_by_bot,
    humano: m.messages_by_human,
    nuevas: m.conversations_new,
  }))

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-semibold">Reportes y Métricas</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard title="Total Contactos" value={contactCount} icon={Users} color="text-blue-500" />
        <KPICard title="Nuevas Convs. (30d)" value={totalConversations} icon={MessageSquare} color="text-indigo-500" />
        <KPICard title="Total Mensajes (30d)" value={totalMessages.toLocaleString()} icon={Zap} color="text-amber-500" />
        <KPICard title="Tasa del Bot" value={`${botRate}%`} icon={Bot} color="text-emerald-500" description="De mensajes totales" />
        <KPICard title="Leads Ganados" value={totalLeadsWon} icon={TrendingUp} color="text-green-500" />
        <KPICard title="Citas Agendadas" value={metrics.reduce((a, m) => a + m.appointments_booked, 0)} icon={Calendar} color="text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Mensajes por día (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Sin datos aún — las métricas se generan automáticamente
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="entrantes" stroke="#6366f1" strokeWidth={2} dot={false} name="Entrantes" />
                  <Line type="monotone" dataKey="salientes" stroke="#10b981" strokeWidth={2} dot={false} name="Salientes" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Funnel pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Distribución del Embudo</CardTitle>
          </CardHeader>
          <CardContent>
            {stageStats.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Sin datos de embudo
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={stageStats}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {stageStats.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bot vs Human */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bot vs. Agente Humano (mensajes)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="bot" fill="#10b981" name="Bot IA" radius={[2, 2, 0, 0]} />
                <Bar dataKey="humano" fill="#6366f1" name="Agente" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
