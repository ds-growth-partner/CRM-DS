

-- ================================================================
-- TUCONTADOR CRM - SCHEMA COMPLETO
-- Multi-tenant con RLS por tenant_id
-- ================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vault" WITH SCHEMA vault;

-- ================================================================
-- 1. TENANTS (Organizaciones/Clientes de TuContador)
-- ================================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,                            -- "Contabilidad López S.A."
    slug TEXT NOT NULL UNIQUE,                     -- "contabilidad-lopez"
    logo_url TEXT,
    plan TEXT NOT NULL DEFAULT 'starter'
        CHECK (plan IN ('starter', 'professional', 'enterprise')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_agents INTEGER NOT NULL DEFAULT 3,
    max_contacts INTEGER NOT NULL DEFAULT 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================================
-- 2. TENANT CREDENTIALS (encriptadas vía Vault)
-- Cada tenant almacena sus credenciales de servicios externos
-- ================================================================
CREATE TABLE tenant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- Meta WhatsApp
    waba_id TEXT,                                  -- WhatsApp Business Account ID
    phone_number_id TEXT,                          -- Phone Number ID de Meta
    meta_access_token TEXT,                        -- System User Token (encriptar con Vault)
    meta_webhook_verify_token TEXT,                -- Token de verificación webhook
    -- Chatwoot
    chatwoot_base_url TEXT,                        -- URL de la instancia Chatwoot
    chatwoot_api_token TEXT,                       -- API access token Chatwoot
    chatwoot_account_id INTEGER,                   -- Account ID en Chatwoot
    -- n8n
    n8n_base_url TEXT,                             -- URL de la instancia n8n
    n8n_webhook_secret TEXT,                       -- HMAC secret para firmar webhooks
    -- Google Calendar
    google_calendar_id TEXT,                       -- ID del calendario
    google_service_account_json TEXT,              -- SA key (encriptar con Vault)
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id)
);

-- NOTA: Las columnas meta_access_token, n8n_webhook_secret y
-- google_service_account_json deben encriptarse vía Supabase Vault.
-- Se crean vault secrets a nivel de aplicación y se referencian
-- por ID en la lógica de n8n o BFF. No se exponen al frontend.

-- ================================================================
-- 3. USERS (Usuarios del CRM, vinculados a Supabase Auth)
-- ================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'agent'
        CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    chatwoot_agent_id INTEGER,                     -- ID del agente en Chatwoot
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(tenant_id, role);

-- ================================================================
-- 4. FUNNEL STAGES (Fases del embudo, configurables por tenant)
-- ================================================================
CREATE TABLE funnel_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                            -- "Nuevo", "Contactado", etc.
    slug TEXT NOT NULL,                            -- "nuevo", "contactado"
    color TEXT NOT NULL DEFAULT '#6366f1',          -- Color hex para badges y Kanban
    position INTEGER NOT NULL DEFAULT 0,           -- Orden en el embudo
    is_won BOOLEAN NOT NULL DEFAULT false,         -- Marca como "ganado"
    is_lost BOOLEAN NOT NULL DEFAULT false,        -- Marca como "perdido"
    is_default BOOLEAN NOT NULL DEFAULT false,     -- Fase por defecto para nuevos contactos
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_funnel_stages_tenant ON funnel_stages(tenant_id, position);

-- ================================================================
-- 5. TAGS (Etiquetas, configurables por tenant)
-- ================================================================
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                            -- "VIP", "Caliente", "Referido"
    color TEXT NOT NULL DEFAULT '#8b5cf6',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tags_tenant ON tags(tenant_id);

-- ================================================================
-- 6. CONTACTS (Tabla maestra de contactos)
-- ================================================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- Datos básicos
    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT,                                    -- Formato E.164: +573001234567
    email TEXT,
    company TEXT,
    job_title TEXT,
    city TEXT,
    country TEXT DEFAULT 'CO',
    -- Referencias externas
    chatwoot_contact_id INTEGER,                   -- ID en Chatwoot
    chatwoot_conversation_id INTEGER,              -- Conversation ID en Chatwoot
    wa_id TEXT,                                    -- WhatsApp ID (phone sin +)
    -- Estado del embudo
    funnel_stage_id UUID REFERENCES funnel_stages(id) ON DELETE SET NULL,
    lead_score INTEGER NOT NULL DEFAULT 0
        CHECK (lead_score >= 0 AND lead_score <= 100),
    -- Origen
    source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('whatsapp', 'web', 'csv', 'manual', 'referral', 'campaign')),
    -- Asignación
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    -- IA
    ai_active BOOLEAN NOT NULL DEFAULT true,       -- Si la IA está operando en esta conversación
    -- Ventana de 24h
    last_incoming_at TIMESTAMPTZ,                  -- Último mensaje entrante (para calcular ventana 24h)
    -- Metadata
    custom_fields JSONB DEFAULT '{}',
    notes TEXT,
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX idx_contacts_phone ON contacts(tenant_id, phone);
CREATE INDEX idx_contacts_email ON contacts(tenant_id, email);
CREATE INDEX idx_contacts_funnel ON contacts(tenant_id, funnel_stage_id);
CREATE INDEX idx_contacts_assigned ON contacts(tenant_id, assigned_to);
CREATE INDEX idx_contacts_score ON contacts(tenant_id, lead_score DESC);
CREATE INDEX idx_contacts_source ON contacts(tenant_id, source);
CREATE INDEX idx_contacts_ai_active ON contacts(tenant_id, ai_active);
CREATE INDEX idx_contacts_wa_id ON contacts(tenant_id, wa_id);
CREATE INDEX idx_contacts_chatwoot ON contacts(chatwoot_contact_id);
CREATE INDEX idx_contacts_updated ON contacts(updated_at DESC);

-- ================================================================
-- 7. CONTACT_TAGS (Relación muchos-a-muchos)
-- ================================================================
CREATE TABLE contact_tags (
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX idx_contact_tags_tag ON contact_tags(tag_id);

-- ================================================================
-- 8. CONVERSATIONS (Metadatos de conversación, espejo de Chatwoot)
-- Estado y metadata que necesitamos más allá de lo que Chatwoot da
-- ================================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    chatwoot_conversation_id INTEGER,              -- ID en Chatwoot
    -- Estado
    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'resolved', 'pending', 'snoozed')),
    ai_active BOOLEAN NOT NULL DEFAULT true,       -- IA controlando vs humano
    assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Ventana de 24h
    window_expires_at TIMESTAMPTZ,                 -- Cuándo expira la ventana de 24h
    -- Métricas
    unread_count INTEGER NOT NULL DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,                     -- Preview del último mensaje
    last_message_direction TEXT
        CHECK (last_message_direction IN ('inbound', 'outbound')),
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_status ON conversations(tenant_id, status);
CREATE INDEX idx_conversations_last_msg ON conversations(tenant_id, last_message_at DESC);
CREATE INDEX idx_conversations_unread ON conversations(tenant_id, unread_count DESC);
CREATE INDEX idx_conversations_assigned ON conversations(tenant_id, assigned_agent_id);
CREATE INDEX idx_conversations_ai ON conversations(tenant_id, ai_active);
CREATE INDEX idx_conversations_chatwoot ON conversations(chatwoot_conversation_id);

-- ================================================================
-- 9. MESSAGES (Copia local de mensajes para búsqueda rápida y
--    para alimentar la memoria del agente IA)
-- ================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    -- Contenido
    content TEXT,                                  -- Texto del mensaje
    content_type TEXT NOT NULL DEFAULT 'text'
        CHECK (content_type IN ('text', 'image', 'audio', 'video',
               'document', 'sticker', 'location', 'contacts', 'template', 'reaction')),
    -- Dirección y autoría
    direction TEXT NOT NULL
        CHECK (direction IN ('inbound', 'outbound')),
    sender_type TEXT NOT NULL DEFAULT 'contact'
        CHECK (sender_type IN ('contact', 'agent', 'bot', 'system')),
    sender_id UUID,                                -- user.id si es agente, NULL si es contact/bot
    -- Media
    media_url TEXT,                                -- URL del archivo adjunto
    media_mime_type TEXT,
    media_filename TEXT,
    media_size_bytes INTEGER,
    -- Ubicación (si content_type = 'location')
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_name TEXT,
    -- Template (si content_type = 'template')
    template_name TEXT,
    template_params JSONB,
    -- Reaction
    reaction_emoji TEXT,                           -- Si es reacción
    reacted_to_message_id UUID,                    -- A qué mensaje reacciona
    -- Referencias externas
    wa_message_id TEXT,                            -- wamid de Meta
    chatwoot_message_id INTEGER,
    -- Estado de entrega
    delivery_status TEXT DEFAULT 'sent'
        CHECK (delivery_status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,                            -- Si falló
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);
CREATE INDEX idx_messages_contact ON messages(contact_id, created_at);
CREATE INDEX idx_messages_wa_id ON messages(wa_message_id);
CREATE INDEX idx_messages_direction ON messages(conversation_id, direction);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- ================================================================
-- 10. AI_ACTIONS ("Mente de la IA" - log de acciones del agente)
-- n8n escribe aquí en cada tool call del agente
-- ================================================================
CREATE TABLE ai_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    -- Acción
    action_type TEXT NOT NULL,                     -- "extract_email", "schedule_appointment",
                                                   -- "qualify_lead", "change_stage", "send_response"
    tool_name TEXT,                                -- Nombre de la tool de n8n
    -- Resultado
    status TEXT NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'failure', 'pending')),
    summary TEXT NOT NULL,                         -- "✓ Cita agendada exitosamente para 15/04..."
    details JSONB,                                 -- Datos completos de la tool call
    -- Contexto
    reasoning TEXT,                                -- "Razón: el cliente confirmó disponibilidad..."
    stage_before TEXT,                             -- Fase del embudo antes
    stage_after TEXT,                              -- Fase del embudo después
    data_captured JSONB,                           -- {"email": "juan@test.com"}
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_ai_actions_conversation ON ai_actions(conversation_id, created_at DESC);
CREATE INDEX idx_ai_actions_tenant ON ai_actions(tenant_id);
CREATE INDEX idx_ai_actions_contact ON ai_actions(contact_id);
CREATE INDEX idx_ai_actions_type ON ai_actions(action_type);

-- ================================================================
-- 11. APPOINTMENTS (Citas/Reuniones)
-- ================================================================
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Detalles
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,                                 -- "Google Meet", "Oficina", URL de Zoom
    -- Tiempos
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'America/Bogota',
    -- Estado
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'confirmed', 'completed',
               'cancelled', 'no_show', 'rescheduled')),
    -- Google Calendar sync
    google_event_id TEXT,                          -- ID del evento en Google Calendar
    google_calendar_id TEXT,                       -- ID del calendario de Google
    google_meet_link TEXT,                         -- Link de Google Meet si aplica
    -- Origen
    created_by TEXT NOT NULL DEFAULT 'manual'
        CHECK (created_by IN ('bot', 'manual', 'import')),
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Metadata
    notes TEXT,
    reminder_sent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX idx_appointments_contact ON appointments(contact_id);
CREATE INDEX idx_appointments_assigned ON appointments(assigned_to);
CREATE INDEX idx_appointments_start ON appointments(tenant_id, start_time);
CREATE INDEX idx_appointments_status ON appointments(tenant_id, status);
CREATE INDEX idx_appointments_google ON appointments(google_event_id);

-- ================================================================
-- 12. HSM_TEMPLATES (Cache local de templates de Meta)
-- ================================================================
CREATE TABLE hsm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    -- Meta data
    meta_template_id TEXT NOT NULL,                -- ID de Meta
    name TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'es',
    category TEXT NOT NULL
        CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION')),
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED')),
    -- Estructura
    header_type TEXT CHECK (header_type IN ('TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'NONE')),
    header_text TEXT,
    body_text TEXT NOT NULL,
    footer_text TEXT,
    buttons JSONB,                                 -- Array de botones [{type, text, url/phone}]
    -- Variables
    variables_count INTEGER NOT NULL DEFAULT 0,
    example_values JSONB,                          -- Valores de ejemplo para preview
    -- Metadata
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, meta_template_id)
);

CREATE INDEX idx_hsm_templates_tenant ON hsm_templates(tenant_id);
CREATE INDEX idx_hsm_templates_status ON hsm_templates(tenant_id, status);
CREATE INDEX idx_hsm_templates_category ON hsm_templates(tenant_id, category);

-- ================================================================
-- 13. CAMPAIGNS (Campañas de envío masivo de plantillas)
-- ================================================================
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    -- Template
    template_id UUID REFERENCES hsm_templates(id) ON DELETE SET NULL,
    template_name TEXT NOT NULL,                   -- Redundante para display rápido
    template_variables JSONB,                      -- Mapping de variables a campos del contacto
    -- Segmentación
    segment_filters JSONB NOT NULL DEFAULT '{}',   -- Filtros aplicados para seleccionar contactos
    total_contacts INTEGER NOT NULL DEFAULT 0,     -- Contactos en el segmento
    -- Estado
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Métricas (actualizadas por n8n)
    sent_count INTEGER NOT NULL DEFAULT 0,
    delivered_count INTEGER NOT NULL DEFAULT 0,
    read_count INTEGER NOT NULL DEFAULT 0,
    replied_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    -- Creador
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_created ON campaigns(created_at DESC);

-- ================================================================
-- 14. CAMPAIGN_MESSAGES (Log de cada envío individual de campaña)
-- ================================================================
CREATE TABLE campaign_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    -- Estado
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'failed')),
    -- Meta IDs
    wa_message_id TEXT,                            -- wamid
    error_code TEXT,
    error_message TEXT,
    -- Timestamps
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_msgs_campaign ON campaign_messages(campaign_id);
CREATE INDEX idx_campaign_msgs_contact ON campaign_messages(contact_id);
CREATE INDEX idx_campaign_msgs_status ON campaign_messages(campaign_id, status);

-- ================================================================
-- 15. PHASE_TRANSITIONS (Historial de cambios de fase)
-- ================================================================
CREATE TABLE phase_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    previous_stage_id UUID REFERENCES funnel_stages(id),
    new_stage_id UUID REFERENCES funnel_stages(id),
    previous_stage_name TEXT,                      -- Desnormalizado para historial
    new_stage_name TEXT,
    -- Contexto
    reason TEXT NOT NULL DEFAULT 'manual'
        CHECK (reason IN ('automatic', 'manual', 'bot', 'campaign')),
    trigger_description TEXT,                      -- "Bot calificó lead como interesado"
    changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phase_transitions_contact ON phase_transitions(contact_id, created_at DESC);
CREATE INDEX idx_phase_transitions_tenant ON phase_transitions(tenant_id);

-- ================================================================
-- 16. ACTIVITY_LOG (Timeline de actividad del contacto)
-- ================================================================
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    -- Actividad
    activity_type TEXT NOT NULL,                   -- "message_sent", "phase_changed",
                                                   -- "appointment_created", "tag_added",
                                                   -- "note_added", "lead_score_changed",
                                                   -- "ai_action", "human_takeover"
    channel TEXT NOT NULL DEFAULT 'system'
        CHECK (channel IN ('whatsapp', 'system', 'manual', 'bot')),
    description TEXT NOT NULL,
    metadata JSONB,
    -- Actor
    performed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    performed_by_name TEXT,                        -- "Bot IA", "Juan Pérez"
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_contact ON activity_log(contact_id, created_at DESC);
CREATE INDEX idx_activity_log_tenant ON activity_log(tenant_id, created_at DESC);
CREATE INDEX idx_activity_log_type ON activity_log(activity_type);

-- ================================================================
-- 17. DAILY_METRICS (Métricas agregadas por día, escritas por n8n)
-- ================================================================
CREATE TABLE daily_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    -- Conversaciones
    conversations_total INTEGER NOT NULL DEFAULT 0,
    conversations_new INTEGER NOT NULL DEFAULT 0,
    conversations_resolved INTEGER NOT NULL DEFAULT 0,
    -- Mensajes
    messages_inbound INTEGER NOT NULL DEFAULT 0,
    messages_outbound INTEGER NOT NULL DEFAULT 0,
    messages_by_bot INTEGER NOT NULL DEFAULT 0,
    messages_by_human INTEGER NOT NULL DEFAULT 0,
    -- Bot performance
    bot_response_avg_seconds DOUBLE PRECISION,
    bot_handoff_count INTEGER NOT NULL DEFAULT 0,  -- Veces que se pasó a humano
    -- Embudo
    leads_new INTEGER NOT NULL DEFAULT 0,
    leads_qualified INTEGER NOT NULL DEFAULT 0,
    leads_won INTEGER NOT NULL DEFAULT 0,
    leads_lost INTEGER NOT NULL DEFAULT 0,
    -- Citas
    appointments_booked INTEGER NOT NULL DEFAULT 0,
    appointments_completed INTEGER NOT NULL DEFAULT 0,
    appointments_no_show INTEGER NOT NULL DEFAULT 0,
    -- Campañas
    campaigns_sent INTEGER NOT NULL DEFAULT 0,
    campaigns_delivered INTEGER NOT NULL DEFAULT 0,
    campaigns_read INTEGER NOT NULL DEFAULT 0,
    campaigns_replied INTEGER NOT NULL DEFAULT 0,
    --
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, date)
);

CREATE INDEX idx_daily_metrics_tenant_date ON daily_metrics(tenant_id, date DESC);

-- ================================================================
-- 18. CONTACT_NOTES (Notas internas sobre contactos)
-- ================================================================
CREATE TABLE contact_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_notes_contact ON contact_notes(contact_id, created_at DESC);

-- ================================================================
-- HABILITAR REALTIME EN TABLAS CLAVE
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE phase_transitions;

-- ================================================================
-- ROW LEVEL SECURITY (RLS) — Multi-tenant
-- ================================================================

-- Helper function: obtener tenant_id del usuario actual
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
    SELECT tenant_id FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: obtener rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
    SELECT role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- Habilitar RLS en todas las tablas ----
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hsm_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;

-- ---- TENANTS ----
CREATE POLICY "tenant_select" ON tenants FOR SELECT TO authenticated
    USING (id = get_user_tenant_id());

CREATE POLICY "tenant_update" ON tenants FOR UPDATE TO authenticated
    USING (id = get_user_tenant_id() AND get_user_role() IN ('owner', 'admin'))
    WITH CHECK (id = get_user_tenant_id());

-- ---- TENANT CREDENTIALS ----
-- Solo owner y admin pueden ver credenciales
CREATE POLICY "creds_select" ON tenant_credentials FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "creds_update" ON tenant_credentials FOR UPDATE TO authenticated
    USING (tenant_id = get_user_tenant_id() AND get_user_role() = 'owner')
    WITH CHECK (tenant_id = get_user_tenant_id());

-- ---- USERS ----
CREATE POLICY "users_select" ON users FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id());

CREATE POLICY "users_insert" ON users FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() IN ('owner', 'admin'));

CREATE POLICY "users_update" ON users FOR UPDATE TO authenticated
    USING (tenant_id = get_user_tenant_id() AND
           (id = auth.uid() OR get_user_role() IN ('owner', 'admin')))
    WITH CHECK (tenant_id = get_user_tenant_id());

-- ---- TABLAS CON tenant_id (patrón genérico) ----
-- Aplicar a: funnel_stages, tags, contacts, conversations, messages,
-- ai_actions, appointments, hsm_templates, campaigns, campaign_messages,
-- phase_transitions, activity_log, daily_metrics, contact_notes

-- SELECT: cualquier usuario autenticado del mismo tenant
-- INSERT: agent, admin, owner (no viewer)
-- UPDATE: agent, admin, owner
-- DELETE: solo admin, owner

-- Macro-aplicación por tabla (ejemplo con contacts, replicar para todas):

CREATE POLICY "contacts_select" ON contacts FOR SELECT TO authenticated
    USING (tenant_id = get_user_tenant_id());
CREATE POLICY "contacts_insert" ON contacts FOR INSERT TO authenticated
    WITH CHECK (tenant_id = get_user_tenant_id() AND get_user_role() != 'viewer');
CREATE POLICY "contacts_update" ON contacts FOR UPDATE TO authenticated
    USING (tenant_id = get_user_tenant_id() AND get_user_role() != 'viewer')
    WITH CHECK (tenant_id = get_user_tenant_id());
CREATE POLICY "contacts_delete" ON contacts FOR DELETE TO authenticated
    USING (tenant_id = get_user_tenant_id() AND get_user_role() IN ('owner', 'admin'));

-- Repetir este patrón para cada tabla con tenant_id:
-- funnel_stages, tags, contact_tags, conversations, messages,
-- ai_actions, appointments, hsm_templates, campaigns, campaign_messages,
-- phase_transitions, activity_log, daily_metrics, contact_notes

-- ---- SERVICE ROLE para n8n ----
-- n8n usará la service_role key de Supabase para escribir
-- directamente, bypassing RLS. Esto es necesario porque n8n
-- no tiene un auth.uid() — actúa como sistema.
-- Alternativa: crear un pg_role custom "n8n_service" con permisos granulares.

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON hsm_templates
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contact_notes
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Trigger: al mover contacto de fase, insertar en phase_transitions
CREATE OR REPLACE FUNCTION log_phase_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.funnel_stage_id IS DISTINCT FROM NEW.funnel_stage_id THEN
        INSERT INTO phase_transitions (tenant_id, contact_id, previous_stage_id, new_stage_id, reason)
        VALUES (NEW.tenant_id, NEW.id, OLD.funnel_stage_id, NEW.funnel_stage_id, 'manual');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_phase_transition AFTER UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION log_phase_transition();

