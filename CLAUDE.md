# TuContador CRM - Product Requirements Document

## 1. Overview

**TuContador-CRM** es una plataforma CRM multi-tenant basada en WhatsApp para firmas contables colombianas. Combina automatización conversacional con IA, gestión de leads y analytics en tiempo real.

- **Nombre del producto:** TuContador CRM
- **Tipo:** SaaS multi-tenant (B2B)
- **Mercado objetivo:** Firmas contables en Colombia
- **Stack principal:** Next.js 16 (App Router) + Supabase (PostgreSQL) + n8n (automatizaciones)
- **Canal principal:** WhatsApp Business API (Meta)

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

### Backend / Database
| Tecnología | Uso |
|------------|-----|
| PostgreSQL (Supabase) | Base de datos relacional |
| Supabase Auth | Authentication (magic link/email OTP) |
| Supabase Realtime | Suscripciones en tiempo real |
| Supabase Vault | Encriptación de credenciales |

### Integraciones
| Servicio | Propósito |
|----------|-----------|
| Meta WhatsApp Business API | Mensajería WhatsApp |
| n8n | Workflow automation + AI agent |
| Google Calendar API | Sync de citas |

---

## 3. Database Schema (19 tablas)

### Tablas principales

#### `tenants`
Organizaciones/clientes principales.
```sql
- id (UUID, PK)
- name (TEXT)              -- "Contabilidad López S.A."
- slug (TEXT, UNIQUE)      -- "contabilidad-lopez"
- logo_url (TEXT)
- plan (TEXT)              -- 'starter' | 'professional' | 'enterprise'
- is_active (BOOLEAN)
- max_agents (INTEGER)     -- Límite de usuarios
- max_contacts (INTEGER)   -- Límite de contactos
- created_at, updated_at
```

#### `tenant_credentials`
Credenciales encriptadas por tenant (Vault).
```sql
- id (UUID, PK)
- tenant_id (UUID, FK)
- waba_id (TEXT)                           -- WhatsApp Business Account ID
- phone_number_id (TEXT)                   -- Phone Number ID de Meta
- meta_access_token (TEXT, encrypted)      -- System User Token
- meta_webhook_verify_token (TEXT)
- n8n_base_url (TEXT)
- n8n_webhook_secret (TEXT, encrypted)     -- HMAC secret
- google_calendar_id (TEXT)
- google_service_account_json (TEXT, encrypted)
```

#### `users`
Usuarios del CRM vinculados a Supabase Auth.
```sql
- id (UUID, PK, FK auth.users)
- tenant_id (UUID, FK)
- full_name, email, avatar_url, phone
- role (TEXT)           -- 'owner' | 'admin' | 'agent' | 'viewer'
- is_active, last_seen_at
```

#### `funnel_stages`
Fases configurables del embudo/kanban.
```sql
- id, tenant_id, name, slug, color, position
- is_won, is_lost, is_default
```

#### `tags`
Etiquetas para categorizar contactos.
```sql
- id, tenant_id, name, color
```

#### `contacts`
Tabla maestra de contactos/leads.
```sql
- id, tenant_id
- first_name, last_name, phone (E.164), email, company, job_title, city, country
- wa_id (WhatsApp ID sin +)
- funnel_stage_id (FK)
- lead_score (0-100)
- source ('whatsapp' | 'web' | 'csv' | 'manual' | 'referral' | 'campaign')
- assigned_to (FK users)
- ai_active (BOOLEAN)              -- Si la IA está controlando
- last_incoming_at (TIMESTAMPTZ)   -- Para ventana 24h
- custom_fields (JSONB)
- notes, last_contacted_at
```

#### `contact_tags`
Relación muchos-a-muchos.
```sql
- contact_id (FK), tag_id (FK)
- PRIMARY KEY (contact_id, tag_id)
```

#### `conversations`
Metadatos de conversación por contacto.
```sql
- id, tenant_id, contact_id (FK)
- status ('open' | 'resolved' | 'pending' | 'snoozed')
- ai_active, assigned_agent_id
- window_expires_at (TIMESTAMPTZ)   -- 24h window
- unread_count, last_message_at, last_message_preview, last_message_direction
```

#### `messages`
Todos los mensajes del sistema.
```sql
- id, tenant_id, conversation_id, contact_id
- content, content_type ('text'|'image'|'audio'|'video'|'document'|'sticker'|'location'|'contacts'|'template'|'reaction')
- direction ('inbound'|'outbound')
- sender_type ('contact'|'agent'|'bot'|'system')
- sender_id (user.id si agente)
- media_url, media_mime_type, media_filename, media_size_bytes
- latitude, longitude, location_name
- template_name, template_params (JSONB)
- reaction_emoji, reacted_to_message_id
- wa_message_id (wamid de Meta)
- delivery_status ('pending'|'sent'|'delivered'|'read'|'failed')
- error_message
```

#### `n8n_chat_histories`
Memoria de conversación del agente IA (formato LangChain).
```sql
- id (BIGSERIAL, PK)
- session_id (TEXT)   -- "<wa_id>@s.whatsapp.net"
- message (JSONB)     -- {type, content, tool_calls?, ...}
- time_stamp
```
**Permisos:** service_role tiene ALL, anon/authenticated tienen SELECT/INSERT/UPDATE.

#### `ai_actions`
Log de acciones del agente IA.
```sql
- id, tenant_id, conversation_id, contact_id
- action_type (TEXT)           -- 'extract_email' | 'schedule_appointment' | etc
- tool_name, status, summary, details (JSONB)
- reasoning, stage_before, stage_after
- data_captured (JSONB)
```

#### `appointments`
Citas con sync a Google Calendar.
```sql
- id, tenant_id, contact_id, assigned_to
- title, description, location
- start_time, end_time, timezone ('America/Bogota')
- status ('scheduled'|'confirmed'|'completed'|'cancelled'|'no_show'|'rescheduled')
- google_event_id, google_calendar_id, google_meet_link
- created_by ('bot'|'manual'|'import')
- reminder_sent
```

#### `hsm_templates`
Cache de templates HSM de Meta.
```sql
- id, tenant_id, meta_template_id
- name, language, category ('MARKETING'|'UTILITY'|'AUTHENTICATION')
- status ('APPROVED'|'PENDING'|'REJECTED'|'PAUSED'|'DISABLED')
- header_type, header_text, body_text, footer_text, buttons (JSONB)
- variables_count, example_values (JSONB)
- last_synced_at
```

#### `campaigns`
Campañas de envío masivo.
```sql
- id, tenant_id, name, description
- template_id (FK hsm_templates), template_name, template_variables (JSONB)
- segment_filters (JSONB), total_contacts
- status ('draft'|'scheduled'|'sending'|'completed'|'failed'|'cancelled')
- scheduled_at, started_at, completed_at
- sent_count, delivered_count, read_count, replied_count, failed_count
- created_by
```

#### `campaign_messages`
Log de cada envío individual.
```sql
- id, tenant_id, campaign_id, contact_id
- status ('pending'|'sent'|'delivered'|'read'|'replied'|'failed')
- wa_message_id, error_code, error_message
- sent_at, delivered_at, read_at, replied_at
```

#### `phase_transitions`
Historial de cambios de fase.
```sql
- id, tenant_id, contact_id
- previous_stage_id, new_stage_id
- previous_stage_name, new_stage_name
- reason ('automatic'|'manual'|'bot'|'campaign')
- trigger_description, changed_by
```

#### `activity_log`
Timeline de actividad del contacto.
```sql
- id, tenant_id, contact_id
- activity_type (TEXT)   -- 'message_sent'|'phase_changed'|'appointment_created'|'tag_added'|'note_added'|'lead_score_changed'|'ai_action'|'human_takeover'
- channel ('whatsapp'|'system'|'manual'|'bot')
- description, metadata (JSONB)
- performed_by, performed_by_name
```

#### `daily_metrics`
Métricas agregadas (escritas por n8n).
```sql
- id, tenant_id, date (UNIQUE tenant_id + date)
- conversations_total, conversations_new, conversations_resolved
- messages_inbound, messages_outbound, messages_by_bot, messages_by_human
- bot_response_avg_seconds, bot_handoff_count
- leads_new, leads_qualified, leads_won, leads_lost
- appointments_booked, appointments_completed, appointments_no_show
- campaigns_sent, campaigns_delivered, campaigns_read, campaigns_replied
```

#### `contact_notes`
Notas internas sobre contactos.
```sql
- id, tenant_id, contact_id, content, created_by
```

---

## 4. Páginas y Rutas

### Autenticación
| Ruta | Descripción |
|------|-------------|
| `/login` | Login con magic link (email OTP) |
| `/auth/callback` | OAuth redirect handler |

### Dashboard (CRM)
| Ruta | Descripción |
|------|-------------|
| `/conversations` | Interfaz de chat WhatsApp (3 paneles) |
| `/contacts` | Lista de contactos (tabla + kanban) |
| `/contacts/[contactId]` | Detalle de contacto |
| `/contacts/import` | Importación CSV (placeholder) |
| `/calendar` | Calendario con Google Calendar sync |
| `/templates` | Lista de templates HSM |
| `/templates/campaigns` | Gestión de campañas |
| `/templates/new` | Crear campaña |
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
| `/api/webhooks/n8n/send-message` | POST | Enviar mensaje saliente |
| `/api/webhooks/n8n/send-campaign` | POST | Trigger campaña |
| `/api/calendar/events` | POST | CRUD citas (dispara webhooks calendar-create/update a n8n) |
| `/api/meta/templates` | GET | Fetch templates de Meta |

---

## 5. Funcionalidades

### 5.1 WhatsApp CRM
- **Mensajería bidireccional** via Meta WhatsApp Business Cloud API (n8n)
- **Interfaz de chat 3 paneles:** lista de conversaciones | chat activo | detalle de contacto
- **Realtime** mensajes via Supabase subscriptions
- **Tipos de mensaje:** texto, imagen, audio, video, documento, sticker, ubicación, contactos, template, reacción
- **Estados de entrega:** pending → sent → delivered → read → failed
- **Ventana de 24 horas:** tracking de `window_expires_at` para mensajes entrantes
- **Human/AI handoff:** `conversations.ai_active` y `contacts.ai_active` (Supabase directo, sin n8n)

### 5.2 Agente IA (n8n)
El bot de IA (n8n) maneja:
- **Calificación de leads** (Lead scoring 0-100)
- **Extracción de datos** (email, teléfono, cita)
- **Agendamiento de citas** (crea en `appointments`)
- **Cambio de fases** (actualiza `funnel_stage_id`)
- **Respuestas proactivas** (envía mensajes automáticos)
- **Toma de control humana** (human handoff)

**Tablas de memoria IA:**
- `n8n_chat_histories` - memoria conversacional (LangChain format)
- `ai_actions` - log de acciones del agente

### 5.3 Embudo/Kanban
- **Fases configurables** por tenant
- **Drag & drop** con @dnd-kit
- **Lead scoring** 0-100
- **Historial de transiciones** (`phase_transitions`)
- Marcas `is_won` / `is_lost` para cierre

### 5.4 Campañas Masivas
- **Templates HSM** de Meta (MARKETING, UTILITY, AUTHENTICATION)
- **Segmentación** por filtros JSONB (tags, fase, score, etc)
- **Tracking individual** por contacto (`campaign_messages`)
- **Métricas:** sent, delivered, read, replied, failed

### 5.5 Calendario
- **Google Calendar** bidirectional sync
- **Google Meet** auto-generado
- **Drag & resize** de eventos
- **Múltiples estados** de cita

### 5.6 Analytics / Reports
- KPIs en tiempo real
- Gráficos de volumen de mensajes
- Distribución del embudo
- Métricas diarias agregadas (`daily_metrics`)
- Metrics de bot: response time, handoff count

### 5.7 Contact Management
- **Vistas:** tabla y kanban
- **Campos personalizados** (JSONB `custom_fields`)
- **Tags** para segmentación
- **Notas internas** (`contact_notes`)
- **Activity timeline** (`activity_log`)
- **Importación CSV** (placeholder)
- **Origen del lead:** whatsapp, web, csv, manual, referral, campaign

### 5.8 Multi-tenant
- **RLS (Row Level Security)** en todas las tablas
- **Aislamiento total** por `tenant_id`
- **Planes:** starter, professional, enterprise (límites de usuarios y contactos)
- **Roles:** owner, admin, agent, viewer

---

## 6. Estructura de Archivos

```
TuContador-CRM/
├── app/
│   ├── (auth)/
│   │   ├── auth/callback/route.ts
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── contacts/
│   │   │   ├── [contactId]/page.tsx
│   │   │   ├── import/page.tsx
│   │   │   └── page.tsx
│   │   ├── conversations/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── templates/
│   │   │   ├── campaigns/page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── page.tsx
│   │   ├── reports/page.tsx
│   │   └── settings/
│   │       ├── canned-responses/page.tsx
│   │       ├── custom-fields/page.tsx
│   │       ├── funnel/page.tsx
│   │       ├── general/page.tsx
│   │       ├── integrations/page.tsx
│   │       ├── tags/page.tsx
│   │       └── users/page.tsx
│   ├── api/
│   │   ├── calendar/
│   │   │   ├── events/route.ts
│   │   │   └── sync/route.ts
│   │   ├── meta/templates/route.ts
│   │   ├── webhooks/
│   │   │   └── n8n/
│   │   │       ├── inbound-message/route.ts
│   │   │       ├── send-message/route.ts
│   │   │       ├── send-campaign/route.ts
│   │   │       ├── move-stage/route.ts
│   │   │       ├── take-control/route.ts
│   │   │       └── release-control/route.ts
│   │   └── chatwoot/route.ts (placeholder)
│   ├── layout.tsx
│   └── page.tsx (redirect a /conversations)
├── components/
│   ├── calendar/
│   ├── contacts/
│   ├── conversations/
│   ├── layout/
│   ├── shared/
│   └── ui/ (shadcn components)
├── hooks/ (12 custom hooks)
├── lib/
│   ├── n8n/
│   │   └── client.ts (HMAC signed webhook client)
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   ├── admin.ts
│   │   └── auth.ts
│   ├── types/
│   └── utils/
├── stores/ (Zustand stores)
├── providers/
├── supabase/
│   ├── schema.sql (734 líneas)
│   └── seed.sql
├── middleware.ts
├── package.json
└── tailwind.config.ts
```

---

## 7. Integraciones

### 7.1 n8n
- **Comunicación:** Webhooks HMAC-signed (`lib/n8n/client.ts`)
- **6 webhooks** definidos en el CRM
- **n8n actúa como:** AI agent, message processor, campaign executor, metrics aggregator
- **Credenciales:** `n8n_base_url`, `n8n_webhook_secret` en `tenant_credentials`

### 7.2 Meta WhatsApp Business API
- **Credenciales:** `waba_id`, `phone_number_id`, `meta_access_token`
- **Webhooks:** inbound messages, delivery status
- **HSM Templates:** cache local (`hsm_templates`)
- **Webhook verify token:** `meta_webhook_verify_token`

### 7.3 Google Calendar
- **Credenciales:** `google_calendar_id`, `google_service_account_json` (Vault encrypted)
- **Features:** create events, sync bidireccional, Google Meet links
- **API:** google Calendar API v3

---

## 8. Automatizaciones n8n

**n8n maneja:**
1. Envío de mensajes WhatsApp (`send-message`)
2. Ejecución de campañas masivas (`send-campaign`)
3. Crear eventos en Google Calendar (`calendar-create`)
4. Actualizar eventos en Google Calendar (`calendar-update`)

**El CRM envía webhooks a n8n:**
- Enviar mensaje (`/send-message`)
- Ejecutar campaña (`/send-campaign`)
- Crear evento (`/calendar-create`)
- Actualizar evento (`/calendar-update`)

**Lo que Supabase maneja directo (sin n8n):**
- Mensajes entrantes → Realtime subscriptions
- Mover fases → `contacts.funnel_stage_id` directo
- Human/AI handoff → `conversations.ai_active` directo

---

## 9. Autenticación y Autorización

### Auth
- **Método:** Magic link (email OTP) via Supabase Auth
- **Session:** Manejada por middleware (`middleware.ts`)
- **Refresh:** Automático en cada request

### Roles
| Rol | Permisos |
|-----|----------|
| owner | Todo + credenciales + settings |
| admin | Todo excepto credenciales |
| agent | CRUD contacts, messages, conversations |
| viewer | Solo lectura |

### RLS
- Todas las tablas tienen `tenant_id`
- Helper: `get_user_tenant_id()` y `get_user_role()`
- n8n usa `service_role` (bypass RLS)

---

## 10. Realtime

Tablas con realtime habilitado:
- `contacts`
- `conversations`
- `messages`
- `n8n_chat_histories`
- `ai_actions`
- `appointments`
- `contact_tags`
- `phase_transitions`

---

## 11. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
N8N_BASE_URL=
N8N_WEBHOOK_SECRET=
META_WABA_ID=
META_PHONE_NUMBER_ID=
META_ACCESS_TOKEN=
GOOGLE_CALENDAR_ID=
```

---

## 12. Características UI/UX

- **Tema:** Dark OLED glassmorphism
- **Tailwind CSS v4** con CSS-first config
- **shadcn/ui** components (35+)
- **Responsive:** Mobile-first
- **Notificaciones:** Sonner toasts
- **Iconos:** Lucide React
