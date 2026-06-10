# DS CRM — Product Requirements Document

## 1. Overview

**DS CRM** es una plataforma CRM SaaS multi-tenant basada en WhatsApp. Permite a cualquier empresa registrarse, crear su organización y gestionar su mensajería, leads y automatizaciones con IA.

- **Nombre del producto:** DS CRM
- **Tipo:** SaaS multi-tenant (B2B)
- **Mercado objetivo:** Empresas que usan WhatsApp Business como canal principal de ventas/atención
- **Stack principal:** Next.js 16 (App Router) + Supabase (PostgreSQL) + Clerk (Auth) + n8n (automatizaciones por tenant) + Resend (emails)
- **Repositorio:** git@github-dsgp:ds-growth-partner/CRM-DS.git

---

## 2. Tech Stack

### Frontend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| Next.js | 16.2.3 | Framework (App Router) |
| React | 19.2.4 | UI library |
| TypeScript | 5 | Lenguaje tipado |
| Tailwind CSS | 4 | Estilos (CSS-first config) |
| Base UI React | 1.4.0 | Componentes base |
| Radix UI | Latest | Primitivos de UI |
| Zustand | 5.0.12 | State management |
| Recharts | 3.8.1 | Gráficos y analytics |
| react-big-calendar | 1.19.4 | Calendario |
| @dnd-kit | 6.3.1 / 10.0.0 | Drag & drop (Kanban) |
| Sonner | 2.0.7 | Notificaciones toast |
| Lucide React | 1.8.0 | Iconos |
| date-fns | 4.1.0 | Utilidades de fecha |
| papaparse | 5.5.3 | Parsing CSV |
| next-themes | 0.4.6 | Theme switching |

### Auth & Backend
| Tecnología | Uso |
|------------|-----|
| Clerk | Autenticación, registro, organizaciones, invitaciones |
| PostgreSQL (Supabase) | Base de datos relacional |
| Supabase Realtime | Suscripciones en tiempo real |
| Resend | Emails transaccionales |

### Integraciones
| Servicio | Propósito |
|----------|-----------|
| Meta WhatsApp Business API | Mensajería WhatsApp (por tenant) |
| n8n | Workflow automation + AI agent (instancia independiente por tenant) |
| Google Calendar API | Sync de citas |

---

## 3. Arquitectura de Auth (Clerk + Supabase)

### Flujo
1. Usuario se registra en `/sign-up` → Clerk crea el usuario
2. Clerk webhook (`/api/webhooks/clerk`) sincroniza a Supabase (`users` table)
3. Usuario crea organización en `/onboarding` → Clerk crea la org
4. Clerk webhook sincroniza org a Supabase (`tenants` table) y vincula el user
5. En el dashboard, `SupabaseProvider` inyecta el JWT de Clerk (`template: 'supabase'`) en cada request
6. Supabase RLS valida el JWT usando las funciones helper

### JWT Template de Clerk (nombre: `supabase`)
```json
{
  "sub": "{{user.id}}",
  "role": "authenticated",
  "org_id": "{{org.id}}",
  "org_role": "{{org.role}}",
  "org_slug": "{{org.slug}}"
}
```
- **Algorithm:** HS256
- **Signing key:** JWT Secret del proyecto Supabase

### Funciones helper en Supabase
- `get_clerk_user_id()` → `auth.jwt() ->> 'sub'`
- `get_clerk_org_id()` → `auth.jwt() ->> 'org_id'`
- `get_tenant_id()` → UUID del tenant via `clerk_org_id`
- `get_user_id()` → UUID del user via `clerk_user_id`
- `is_super_admin()` → busca en tabla `super_admins`
- `has_role(required_role)` → valida jerarquía de roles

### Roles
| Clerk Role | CRM Role | Permisos |
|------------|----------|----------|
| `org:owner` | owner | Todo + credenciales |
| `org:admin` | admin | Todo excepto credenciales |
| `org:member` | agent | CRUD contacts, messages, conversations |
| `org:viewer` | viewer | Solo lectura |

---

## 4. Database Schema (22 tablas)

### Tablas core

#### `super_admins`
Equipo de DS CRM con acceso total a todos los tenants.
```sql
- id (UUID, PK)
- clerk_user_id (TEXT, UNIQUE)
- email, name
- is_active (BOOLEAN)
```

#### `tenants`
Organizaciones cliente. Una por cada Clerk Organization.
```sql
- id (UUID, PK)
- clerk_org_id (TEXT, UNIQUE)     -- Clerk Organization ID
- name, slug (UNIQUE), logo_url
- plan ('starter' | 'professional' | 'enterprise')
- is_active, max_agents, max_contacts
```

#### `users`
Usuarios sincronizados desde Clerk via webhook.
```sql
- id (UUID, PK)
- clerk_user_id (TEXT, UNIQUE)    -- Clerk User ID
- tenant_id (UUID, FK)
- full_name, email, avatar_url, phone
- role ('owner' | 'admin' | 'agent' | 'viewer')
- is_active, last_seen_at
```

#### `tenant_credentials`
Credenciales de integraciones por tenant.
```sql
- tenant_id (UUID, UNIQUE FK)
- waba_id, phone_number_id, meta_access_token, meta_webhook_verify_token
- n8n_base_url, n8n_webhook_secret        -- n8n independiente por tenant
- google_calendar_id, google_service_account_json
```

#### `funnel_stages` — Fases configurables del kanban
#### `tags` — Etiquetas para contactos
#### `contacts` — Leads/contactos master
#### `contact_tags` — Relación muchos-a-muchos
#### `conversations` — Metadatos de conversación WhatsApp
#### `messages` — Todos los mensajes
#### `n8n_chat_histories` — Memoria del agente IA (LangChain)
#### `ai_actions` — Log de acciones del bot
#### `appointments` — Citas con Google Calendar sync
#### `hsm_templates` — Cache de templates Meta
#### `campaigns` — Campañas masivas
#### `campaign_messages` — Tracking por contacto
#### `phase_transitions` — Historial de cambios de fase
#### `activity_log` — Timeline de actividad del contacto
#### `daily_metrics` — Métricas agregadas por n8n
#### `contact_notes` — Notas internas
#### `canned_responses` — Respuestas rápidas
#### `custom_field_definitions` — Campos personalizados

---

## 5. Páginas y Rutas

### Autenticación (Clerk)
| Ruta | Descripción |
|------|-------------|
| `/sign-in` | Login con Clerk |
| `/sign-up` | Registro con Clerk |
| `/onboarding` | Crear organización post-registro |

### Dashboard (CRM)
| Ruta | Descripción |
|------|-------------|
| `/conversations` | Interfaz de chat WhatsApp (3 paneles) |
| `/contacts` | Lista de contactos (tabla + kanban) |
| `/contacts/[contactId]` | Detalle de contacto |
| `/calendar` | Calendario con Google Calendar sync |
| `/templates` | Lista de templates HSM |
| `/campaigns` | Gestión de campañas |
| `/campaigns/new` | Crear campaña |
| `/campaigns/[campaignId]` | Detalle de campaña |
| `/reports` | Dashboard de analytics |
| `/settings/general` | Configuración del tenant |
| `/settings/users` | Gestión de usuarios |
| `/settings/funnel` | Configuración de fases |
| `/settings/tags` | Gestión de etiquetas |
| `/settings/canned-responses` | Respuestas rápidas |
| `/settings/custom-fields` | Campos personalizados |
| `/settings/integrations` | Credenciales Meta, n8n, Google |

### API Routes
| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/webhooks/clerk` | POST | Sincroniza Clerk users/orgs → Supabase |
| `/api/webhooks/n8n/send-message` | POST | Enviar mensaje saliente vía n8n |
| `/api/webhooks/n8n/send-campaign` | POST | Trigger campaña en n8n |
| `/api/webhooks/n8n/take-control` | POST | Toma de control humano |
| `/api/webhooks/n8n/release-control` | POST | Devuelve control al bot |
| `/api/calendar/events` | POST | CRUD citas (dispara webhooks a n8n) |
| `/api/meta/templates` | GET/POST | Fetch/crear templates de Meta |
| `/api/meta/templates/sync` | POST | Sincronizar templates desde n8n del tenant |

---

## 6. Funcionalidades

### 6.1 WhatsApp CRM
- Mensajería bidireccional via Meta WhatsApp Business Cloud API (n8n por tenant)
- Interfaz de chat 3 paneles: lista de conversaciones | chat activo | detalle de contacto
- Realtime mensajes via Supabase subscriptions
- Tipos de mensaje: texto, imagen, audio, video, documento, sticker, ubicación, contactos, template, reacción
- Estados de entrega: pending → sent → delivered → read → failed
- Ventana de 24 horas tracking
- Human/AI handoff

### 6.2 Multi-tenant Real
- Cualquier usuario puede registrarse y crear su organización
- Clerk Organizations = tenants del CRM
- Invitaciones de usuarios vía Clerk
- Roles por organización: owner, admin, agent, viewer
- RLS completo en Supabase por tenant
- Panel de Super Admin (DS CRM team)

### 6.3 n8n por Tenant
- Cada cliente tiene su propia instancia de n8n
- Credenciales guardadas en `tenant_credentials` (n8n_base_url + n8n_webhook_secret)
- El CRM firma los webhooks con HMAC (lib/n8n/client.ts)

### 6.4 Agente IA
- Calificación de leads (0-100)
- Extracción de datos, agendamiento de citas, cambio de fases
- Memoria en `n8n_chat_histories` (LangChain format)
- Log en `ai_actions`

### 6.5 Embudo/Kanban
- Fases configurables por tenant
- Drag & drop con @dnd-kit
- Historial de transiciones (`phase_transitions`)

### 6.6 Campañas Masivas
- Templates HSM (MARKETING, UTILITY, AUTHENTICATION)
- Segmentación por filtros JSONB
- Tracking individual por contacto

### 6.7 Calendario
- Google Calendar bidirectional sync
- Google Meet auto-generado

### 6.8 Analytics
- KPIs en tiempo real
- Métricas diarias agregadas (`daily_metrics`)
- Métricas de bot: response time, handoff count

---

## 7. Estructura de Archivos

```
ds-crm/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx    # Clerk SignIn component
│   │   ├── sign-up/[[...sign-up]]/page.tsx    # Clerk SignUp component
│   │   └── layout.tsx                          # Auth layout (DS CRM branding)
│   ├── (dashboard)/
│   │   ├── contacts/
│   │   ├── conversations/
│   │   ├── calendar/
│   │   ├── campaigns/
│   │   ├── reports/
│   │   ├── templates/
│   │   └── settings/
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── clerk/route.ts                  # Clerk → Supabase sync
│   │   │   └── n8n/                            # n8n webhook handlers
│   │   ├── calendar/events/route.ts
│   │   └── meta/templates/route.ts
│   ├── onboarding/page.tsx                     # Create org post-signup
│   ├── layout.tsx                              # ClerkProvider root
│   └── page.tsx                               # redirect → /conversations
├── components/
│   ├── calendar/, contacts/, conversations/
│   ├── layout/ (sidebar, topbar)
│   ├── shared/, ui/
├── hooks/ (13 custom hooks)
├── lib/
│   ├── n8n/client.ts          # HMAC signed webhook client
│   ├── supabase/
│   │   ├── client.ts          # Browser client (Clerk JWT injection)
│   │   ├── server.ts          # Server client (service role + Clerk token)
│   │   ├── admin.ts           # Admin client (service role)
│   │   └── auth-context.ts    # getAuthContext() para API routes
│   └── types/database.ts      # TypeScript types (con clerk_user_id, clerk_org_id)
├── middleware.ts               # Clerk middleware (protege todas las rutas)
├── providers/
│   ├── auth-provider.tsx       # useAuth() → user + tenant desde Supabase
│   ├── supabase-provider.tsx   # Supabase client con JWT de Clerk
│   └── theme-provider.tsx
├── stores/
│   ├── conversation-store.ts
│   └── ui-store.ts
├── supabase/
│   └── schema.sql              # Schema completo (22 tablas, RLS, Clerk JWT)
└── .env.example                # Variables requeridas
```

---

## 8. Variables de Entorno

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/conversations
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
CLERK_WEBHOOK_SECRET=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# App
NEXT_PUBLIC_APP_URL=
```

---

## 9. Setup Clerk — Pasos críticos

1. **JWT Template** `supabase` con HS256 + Supabase JWT Secret + claims: `sub`, `role: "authenticated"`, `org_id`, `org_role`
2. **Organizations** activadas en el dashboard de Clerk
3. **Webhook** en `/api/webhooks/clerk` suscrito a: `user.created/updated`, `organization.created/updated`, `organizationMembership.created/updated/deleted`
4. **Roles custom** en Clerk: `org:owner`, `org:admin`, `org:member` (default), `org:viewer`

---

## 10. Realtime (tablas con suscripciones)

- `contacts`, `conversations`, `messages`
- `n8n_chat_histories`, `ai_actions`
- `appointments`, `contact_tags`, `phase_transitions`

---

## 11. Pendiente / Próximas fases

- [ ] Regenerar tipos TypeScript desde el schema real (`supabase gen types`)
- [ ] Super Admin Panel (`/admin`) — ver todos los tenants, métricas globales
- [ ] Billing / Planes (Stripe)
- [ ] WhatsApp Embedded Signup (conectar WABA desde el CRM)
- [ ] Resend — emails de invitación y bienvenida
- [ ] Vercel deployment setup
