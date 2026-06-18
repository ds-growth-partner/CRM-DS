-- ============================================================
-- DS CRM — Complete Database Schema
-- Auth: Clerk (clerk_user_id / clerk_org_id)
-- Run this in the Supabase SQL Editor of your new project
-- ============================================================

-- ─────────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ─────────────────────────────────────────────
-- SUPER ADMINS (DS CRM platform team)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS super_admins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id    TEXT UNIQUE NOT NULL,
  email            TEXT NOT NULL,
  name             TEXT,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────
-- AUTO-UPDATE TRIGGER FUNCTION
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────
-- TENANTS (one per Clerk organization)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id  TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  logo_url      TEXT,
  plan          TEXT DEFAULT 'starter' CHECK (plan IN ('starter','professional','enterprise')),
  is_active     BOOLEAN DEFAULT true,
  max_agents    INTEGER DEFAULT 3,
  max_contacts  INTEGER DEFAULT 1000,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────
-- USERS (synced from Clerk via webhook)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT UNIQUE NOT NULL,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  full_name       TEXT,
  email           TEXT NOT NULL,
  avatar_url      TEXT,
  phone           TEXT,
  role            TEXT DEFAULT 'agent' CHECK (role IN ('owner','admin','agent','viewer')),
  is_active       BOOLEAN DEFAULT true,
  last_seen_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────
-- TENANT CREDENTIALS (API keys per tenant)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_credentials (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  waba_id                     TEXT,
  phone_number_id             TEXT,
  meta_access_token           TEXT,
  meta_webhook_verify_token   TEXT,
  n8n_base_url                TEXT,
  n8n_webhook_secret          TEXT,
  google_calendar_id          TEXT,
  google_service_account_json TEXT,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER tenant_credentials_updated_at
  BEFORE UPDATE ON tenant_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────
-- FUNNEL STAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS funnel_stages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  color       TEXT DEFAULT '#6366f1',
  position    INTEGER NOT NULL DEFAULT 0,
  is_won      BOOLEAN DEFAULT false,
  is_lost     BOOLEAN DEFAULT false,
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, slug)
);


-- ─────────────────────────────────────────────
-- TAGS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, name)
);


-- ─────────────────────────────────────────────
-- CONTACTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  first_name          TEXT,
  last_name           TEXT,
  phone               TEXT,
  email               TEXT,
  company             TEXT,
  job_title           TEXT,
  city                TEXT,
  country             TEXT,
  wa_id               TEXT,
  funnel_stage_id     UUID REFERENCES funnel_stages(id) ON DELETE SET NULL,
  lead_score          INTEGER DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  source              TEXT DEFAULT 'manual' CHECK (source IN ('whatsapp','web','csv','manual','referral','campaign')),
  assigned_to         UUID REFERENCES users(id) ON DELETE SET NULL,
  ai_active           BOOLEAN DEFAULT false,
  last_incoming_at    TIMESTAMPTZ,
  last_contacted_at   TIMESTAMPTZ,
  custom_fields       JSONB DEFAULT '{}',
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────
-- CONTACT TAGS (many-to-many)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_tags (
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);


-- ─────────────────────────────────────────────
-- CONVERSATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id              UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status                  TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','pending','snoozed')),
  ai_active               BOOLEAN DEFAULT false,
  assigned_agent_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  window_expires_at       TIMESTAMPTZ,
  unread_count            INTEGER DEFAULT 0,
  last_message_at         TIMESTAMPTZ,
  last_message_preview    TEXT,
  last_message_direction  TEXT CHECK (last_message_direction IN ('inbound','outbound')),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, contact_id)
);

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────
-- MESSAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id       UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id            UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  content               TEXT,
  content_type          TEXT DEFAULT 'text' CHECK (content_type IN (
                          'text','image','audio','video','document',
                          'sticker','location','contacts','template','reaction'
                        )),
  direction             TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type           TEXT NOT NULL CHECK (sender_type IN ('contact','agent','bot','system')),
  sender_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  media_url             TEXT,
  media_mime_type       TEXT,
  media_filename        TEXT,
  media_size_bytes      INTEGER,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  location_name         TEXT,
  template_name         TEXT,
  template_params       JSONB,
  reaction_emoji        TEXT,
  reacted_to_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  wa_message_id         TEXT UNIQUE,
  delivery_status       TEXT DEFAULT 'pending' CHECK (delivery_status IN (
                          'pending','sent','delivered','read','failed'
                        )),
  error_message         TEXT,
  created_at            TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────
-- N8N CHAT HISTORIES (AI memory — LangChain)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS n8n_chat_histories (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL,           -- convention: '<tenant_id>:<wa_id>' (tenant-scoped)
  message     JSONB NOT NULL,
  tenant_id   UUID,                    -- derived from session_id prefix by trigger (see below)
  time_stamp  TIMESTAMPTZ DEFAULT now()
);

-- Derive tenant_id from the session_id prefix so the bot's memory is isolated
-- per tenant even though the LangChain node only writes (session_id, message).
CREATE OR REPLACE FUNCTION n8n_chat_set_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND position(':' in NEW.session_id) > 0 THEN
    BEGIN
      NEW.tenant_id := split_part(NEW.session_id, ':', 1)::uuid;
    EXCEPTION WHEN others THEN
      NEW.tenant_id := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS n8n_chat_set_tenant_trg ON n8n_chat_histories;
CREATE TRIGGER n8n_chat_set_tenant_trg
  BEFORE INSERT ON n8n_chat_histories
  FOR EACH ROW EXECUTE FUNCTION n8n_chat_set_tenant();


-- ─────────────────────────────────────────────
-- AI ACTIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_actions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  contact_id       UUID REFERENCES contacts(id) ON DELETE CASCADE,
  action_type      TEXT NOT NULL,
  tool_name        TEXT,
  status           TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  summary          TEXT,
  details          JSONB,
  reasoning        TEXT,
  stage_before     TEXT,
  stage_after      TEXT,
  data_captured    JSONB,
  created_at       TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id          UUID REFERENCES contacts(id) ON DELETE CASCADE,
  assigned_to         UUID REFERENCES users(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  location            TEXT,
  start_time          TIMESTAMPTZ NOT NULL,
  end_time            TIMESTAMPTZ NOT NULL,
  timezone            TEXT DEFAULT 'America/Bogota',
  status              TEXT DEFAULT 'scheduled' CHECK (status IN (
                        'scheduled','confirmed','completed','cancelled','no_show','rescheduled'
                      )),
  google_event_id     TEXT,
  google_calendar_id  TEXT,
  google_meet_link    TEXT,
  created_by          TEXT DEFAULT 'manual' CHECK (created_by IN ('bot','manual','import')),
  reminder_sent       BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────
-- HSM TEMPLATES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hsm_templates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  meta_template_id    TEXT NOT NULL,
  name                TEXT NOT NULL,
  language            TEXT NOT NULL,
  category            TEXT CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  status              TEXT CHECK (status IN ('APPROVED','PENDING','REJECTED','PAUSED','DISABLED')),
  header_type         TEXT,
  header_text         TEXT,
  body_text           TEXT,
  footer_text         TEXT,
  buttons             JSONB,
  variables_count     INTEGER DEFAULT 0,
  example_values      JSONB,
  last_synced_at      TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, meta_template_id)
);


-- ─────────────────────────────────────────────
-- CAMPAIGNS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  template_id         UUID REFERENCES hsm_templates(id) ON DELETE SET NULL,
  template_name       TEXT,
  template_variables  JSONB,
  segment_filters     JSONB DEFAULT '{}',
  total_contacts      INTEGER DEFAULT 0,
  status              TEXT DEFAULT 'draft' CHECK (status IN (
                        'draft','scheduled','sending','completed','failed','cancelled'
                      )),
  scheduled_at        TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  sent_count          INTEGER DEFAULT 0,
  delivered_count     INTEGER DEFAULT 0,
  read_count          INTEGER DEFAULT 0,
  replied_count       INTEGER DEFAULT 0,
  failed_count        INTEGER DEFAULT 0,
  created_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────
-- CAMPAIGN MESSAGES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id    UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status        TEXT DEFAULT 'pending' CHECK (status IN (
                  'pending','sent','delivered','read','replied','failed'
                )),
  wa_message_id TEXT,
  error_code    TEXT,
  error_message TEXT,
  sent_at       TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  read_at       TIMESTAMPTZ,
  replied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────
-- PHASE TRANSITIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phase_transitions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id           UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  previous_stage_id    UUID REFERENCES funnel_stages(id) ON DELETE SET NULL,
  new_stage_id         UUID REFERENCES funnel_stages(id) ON DELETE SET NULL,
  previous_stage_name  TEXT,
  new_stage_name       TEXT,
  reason               TEXT DEFAULT 'manual' CHECK (reason IN ('automatic','manual','bot','campaign')),
  trigger_description  TEXT,
  changed_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────
-- ACTIVITY LOG
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id         UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  activity_type      TEXT NOT NULL CHECK (activity_type IN (
                       'message_sent','message_received','phase_changed',
                       'appointment_created','appointment_updated',
                       'tag_added','tag_removed','note_added',
                       'lead_score_changed','ai_action','human_takeover',
                       'campaign_sent','contact_created','contact_updated'
                     )),
  channel            TEXT DEFAULT 'system' CHECK (channel IN ('whatsapp','system','manual','bot')),
  description        TEXT,
  metadata           JSONB,
  performed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  performed_by_name  TEXT,
  created_at         TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────
-- DAILY METRICS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_metrics (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date                      DATE NOT NULL,
  conversations_total       INTEGER DEFAULT 0,
  conversations_new         INTEGER DEFAULT 0,
  conversations_resolved    INTEGER DEFAULT 0,
  messages_inbound          INTEGER DEFAULT 0,
  messages_outbound         INTEGER DEFAULT 0,
  messages_by_bot           INTEGER DEFAULT 0,
  messages_by_human         INTEGER DEFAULT 0,
  bot_response_avg_seconds  INTEGER DEFAULT 0,
  bot_handoff_count         INTEGER DEFAULT 0,
  leads_new                 INTEGER DEFAULT 0,
  leads_qualified           INTEGER DEFAULT 0,
  leads_won                 INTEGER DEFAULT 0,
  leads_lost                INTEGER DEFAULT 0,
  appointments_booked       INTEGER DEFAULT 0,
  appointments_completed    INTEGER DEFAULT 0,
  appointments_no_show      INTEGER DEFAULT 0,
  campaigns_sent            INTEGER DEFAULT 0,
  campaigns_delivered       INTEGER DEFAULT 0,
  campaigns_read            INTEGER DEFAULT 0,
  campaigns_replied         INTEGER DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, date)
);


-- ─────────────────────────────────────────────
-- CONTACT NOTES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ─────────────────────────────────────────────
-- CANNED RESPONSES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS canned_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  shortcut    TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, shortcut)
);

CREATE TRIGGER canned_responses_updated_at
  BEFORE UPDATE ON canned_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─────────────────────────────────────────────
-- CUSTOM FIELD DEFINITIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  field_key    TEXT NOT NULL,
  label        TEXT NOT NULL,
  field_type   TEXT DEFAULT 'text' CHECK (field_type IN ('text','number','date','boolean','select')),
  options      JSONB,
  is_required  BOOLEAN DEFAULT false,
  position     INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, field_key)
);


-- ─────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id        ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id            ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_clerk_org_id       ON tenants(clerk_org_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id         ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_wa_id             ON contacts(wa_id);
CREATE INDEX IF NOT EXISTS idx_contacts_funnel_stage_id   ON contacts(funnel_stage_id);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to       ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id    ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id   ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status       ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id   ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact_id        ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_wa_message_id     ON messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at        ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_n8n_chat_session_id        ON n8n_chat_histories(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_contact_id    ON activity_log(contact_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_id     ON activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_phase_transitions_contact  ON phase_transitions(contact_id);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant_date  ON daily_metrics(tenant_id, date DESC);


-- ─────────────────────────────────────────────
-- HELPER FUNCTIONS (after tables exist)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_clerk_user_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'sub'
$$;

CREATE OR REPLACE FUNCTION get_clerk_org_id()
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'org_id'
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins
    WHERE clerk_user_id = (auth.jwt() ->> 'sub')
      AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION get_tenant_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.tenants
  WHERE clerk_org_id = (auth.jwt() ->> 'org_id')
$$;

CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.users
  WHERE clerk_user_id = (auth.jwt() ->> 'sub')
$$;

CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT CASE (auth.jwt() ->> 'org_role')
    WHEN 'org:owner'  THEN required_role IN ('owner','admin','agent','viewer')
    WHEN 'org:admin'  THEN required_role IN ('admin','agent','viewer')
    WHEN 'org:member' THEN required_role IN ('agent','viewer')
    WHEN 'org:viewer' THEN required_role IN ('viewer')
    ELSE false
  END
$$;


-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY — Enable
-- ─────────────────────────────────────────────
ALTER TABLE super_admins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_credentials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE funnel_stages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE n8n_chat_histories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_actions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE hsm_templates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns                ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE phase_transitions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log             ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_notes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE canned_responses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────
-- RLS POLICIES
-- ─────────────────────────────────────────────

-- super_admins
CREATE POLICY "super_admins_self_read" ON super_admins
  FOR SELECT USING (clerk_user_id = get_clerk_user_id());

-- tenants
CREATE POLICY "tenants_read" ON tenants
  FOR SELECT USING (
    is_super_admin() OR clerk_org_id = get_clerk_org_id()
  );
CREATE POLICY "tenants_update" ON tenants
  FOR UPDATE USING (
    is_super_admin() OR (clerk_org_id = get_clerk_org_id() AND has_role('owner'))
  );
CREATE POLICY "tenants_insert" ON tenants
  FOR INSERT WITH CHECK (true); -- Clerk webhook / service_role

-- users
CREATE POLICY "users_read" ON users
  FOR SELECT USING (
    is_super_admin() OR tenant_id = get_tenant_id()
  );
CREATE POLICY "users_update" ON users
  FOR UPDATE USING (
    is_super_admin()
    OR clerk_user_id = get_clerk_user_id()
    OR (tenant_id = get_tenant_id() AND has_role('admin'))
  );
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (true); -- Clerk webhook / service_role

-- tenant_credentials (owner + admin only)
CREATE POLICY "credentials_read" ON tenant_credentials
  FOR SELECT USING (
    is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('admin'))
  );
CREATE POLICY "credentials_write" ON tenant_credentials
  FOR ALL USING (
    is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('owner'))
  );

-- n8n_chat_histories — tenant-isolated via the tenant_id derived from session_id.
-- n8n connects to Postgres as the table owner (direct connection) which bypasses
-- RLS, so its reads/writes are unaffected; this only constrains the CRM API.
CREATE POLICY "n8n_chat_tenant" ON n8n_chat_histories
  FOR ALL
  USING (is_super_admin() OR tenant_id = get_tenant_id())
  WITH CHECK (is_super_admin() OR tenant_id = get_tenant_id());

CREATE INDEX IF NOT EXISTS idx_n8n_chat_tenant_session
  ON n8n_chat_histories (tenant_id, session_id);

-- All other tables: tenant-scoped, agents and above
CREATE POLICY "funnel_stages_read"  ON funnel_stages  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "funnel_stages_write" ON funnel_stages  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "tags_read"  ON tags  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "tags_write" ON tags  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "contacts_read"  ON contacts  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "contacts_write" ON contacts  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "contact_tags_read"  ON contact_tags  FOR SELECT USING (is_super_admin() OR (SELECT tenant_id FROM contacts WHERE id = contact_id) = get_tenant_id());
CREATE POLICY "contact_tags_write" ON contact_tags  FOR ALL    USING (is_super_admin() OR (SELECT tenant_id FROM contacts WHERE id = contact_id) = get_tenant_id());

CREATE POLICY "conversations_read"  ON conversations  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "conversations_write" ON conversations  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "messages_read"  ON messages  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "messages_write" ON messages  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "ai_actions_read"  ON ai_actions  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "ai_actions_write" ON ai_actions  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "appointments_read"  ON appointments  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "appointments_write" ON appointments  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "hsm_templates_read"  ON hsm_templates  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "hsm_templates_write" ON hsm_templates  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "campaigns_read"  ON campaigns  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "campaigns_write" ON campaigns  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('admin')));

CREATE POLICY "campaign_messages_read"  ON campaign_messages  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "campaign_messages_write" ON campaign_messages  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "phase_transitions_read"  ON phase_transitions  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "phase_transitions_write" ON phase_transitions  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "activity_log_read"  ON activity_log  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "activity_log_write" ON activity_log  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "daily_metrics_read"  ON daily_metrics  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "daily_metrics_write" ON daily_metrics  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('admin')));

CREATE POLICY "contact_notes_read"  ON contact_notes  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "contact_notes_write" ON contact_notes  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('agent')));

CREATE POLICY "canned_responses_read"  ON canned_responses  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "canned_responses_write" ON canned_responses  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('admin')));

CREATE POLICY "custom_fields_read"  ON custom_field_definitions  FOR SELECT USING (is_super_admin() OR tenant_id = get_tenant_id());
CREATE POLICY "custom_fields_write" ON custom_field_definitions  FOR ALL    USING (is_super_admin() OR (tenant_id = get_tenant_id() AND has_role('admin')));


-- ─────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE n8n_chat_histories;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE contact_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE phase_transitions;


-- ─────────────────────────────────────────────
-- SERVICE ROLE GRANTS (for n8n and webhooks)
-- ─────────────────────────────────────────────
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;


-- ─────────────────────────────────────────────
-- INBOUND WHATSAPP ROUTING (migration: inbound_whatsapp_tenant_routing)
-- Maps the Meta phone_number_id on each inbound message -> tenant_id.
-- ─────────────────────────────────────────────

-- A phone_number_id / waba_id belongs to exactly one tenant (routing keys).
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_credentials_phone_number_id
  ON tenant_credentials (phone_number_id)
  WHERE phone_number_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_credentials_waba_id
  ON tenant_credentials (waba_id)
  WHERE waba_id IS NOT NULL;

-- Enable contact upserts by WhatsApp id within a tenant
-- (multiple NULL wa_id rows are still allowed — NULLs are distinct).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_contacts_tenant_wa_id'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT uq_contacts_tenant_wa_id UNIQUE (tenant_id, wa_id);
  END IF;
END $$;

-- Resolver used by n8n: phone_number_id -> tenant_id
CREATE OR REPLACE FUNCTION resolve_tenant_by_phone_number_id(p_phone_number_id text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM tenant_credentials
  WHERE phone_number_id = p_phone_number_id
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION resolve_tenant_by_phone_number_id(text)
  TO anon, authenticated, service_role;


-- ─────────────────────────────────────────────
-- INBOUND MESSAGE INGESTION (migration: ingest_inbound_whatsapp_message)
-- ─────────────────────────────────────────────
-- Single atomic entrypoint the client's n8n calls per inbound WhatsApp message.
-- It resolves the tenant by phone_number_id, gets-or-creates the contact (by
-- wa_id) and the conversation (UNIQUE tenant_id,contact_id), inserts the inbound
-- message, and refreshes the 24h window + denormalized conversation fields.
-- Idempotent on wa_message_id (re-deliveries don't duplicate or bump unread).
--
-- n8n usage (Supabase node / RPC):
--   POST {SUPABASE_URL}/rest/v1/rpc/ingest_inbound_message
--   body: { "p_phone_number_id": "...", "p_wa_id": "...", "p_content": "...",
--           "p_wa_message_id": "...", "p_content_type": "text",
--           "p_contact_name": "..." }
--   returns: { tenant_id, contact_id, conversation_id, message_id, duplicate }
CREATE OR REPLACE FUNCTION ingest_inbound_message(
  p_phone_number_id text,
  p_wa_id           text,
  p_content         text,
  p_wa_message_id   text   DEFAULT NULL,
  p_content_type    text   DEFAULT 'text',
  p_contact_name    text   DEFAULT NULL,
  p_media_url       text   DEFAULT NULL,
  p_media_mime_type text   DEFAULT NULL,
  p_media_filename  text   DEFAULT NULL,
  p_latitude        double precision DEFAULT NULL,
  p_longitude       double precision DEFAULT NULL,
  p_location_name   text   DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id       uuid;
  v_contact_id      uuid;
  v_conversation_id uuid;
  v_message_id      uuid;
  v_first           text;
  v_last            text;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM tenant_credentials
  WHERE phone_number_id = p_phone_number_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant configured for phone_number_id %', p_phone_number_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF p_contact_name IS NOT NULL AND length(trim(p_contact_name)) > 0 THEN
    v_first := split_part(trim(p_contact_name), ' ', 1);
    v_last  := NULLIF(trim(substring(trim(p_contact_name) FROM position(' ' IN trim(p_contact_name)) + 1)), '');
  END IF;

  INSERT INTO contacts (tenant_id, wa_id, phone, first_name, last_name, source, last_incoming_at)
  VALUES (v_tenant_id, p_wa_id, p_wa_id, v_first, v_last, 'whatsapp', now())
  ON CONFLICT (tenant_id, wa_id) DO UPDATE
    SET last_incoming_at = now(),
        first_name = COALESCE(contacts.first_name, EXCLUDED.first_name),
        last_name  = COALESCE(contacts.last_name,  EXCLUDED.last_name)
  RETURNING id INTO v_contact_id;

  -- conversation_id left NULL → BEFORE trigger attaches it;
  -- AFTER trigger updates window/preview/unread.
  INSERT INTO messages (
    tenant_id, contact_id, content, content_type, direction, sender_type,
    media_url, media_mime_type, media_filename, latitude, longitude,
    location_name, wa_message_id, delivery_status
  )
  VALUES (
    v_tenant_id, v_contact_id, p_content, p_content_type, 'inbound', 'contact',
    p_media_url, p_media_mime_type, p_media_filename, p_latitude, p_longitude,
    p_location_name, p_wa_message_id, 'delivered'
  )
  ON CONFLICT (wa_message_id) DO NOTHING
  RETURNING id, conversation_id INTO v_message_id, v_conversation_id;

  -- on duplicate delivery the insert is skipped — fetch the existing conversation
  IF v_conversation_id IS NULL THEN
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE tenant_id = v_tenant_id AND contact_id = v_contact_id;
  END IF;

  RETURN jsonb_build_object(
    'tenant_id',       v_tenant_id,
    'contact_id',      v_contact_id,
    'conversation_id', v_conversation_id,
    'message_id',      v_message_id,
    'duplicate',       (v_message_id IS NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ingest_inbound_message(
  text, text, text, text, text, text, text, text, text,
  double precision, double precision, text
) TO service_role, authenticated, anon;


-- ─────────────────────────────────────────────
-- AUTO-CONVERSATION (migration: auto_conversation_triggers_and_get_or_create)
-- ─────────────────────────────────────────────
-- Conversations are created and maintained automatically at the DB layer, so any
-- inbound/outbound message insert (from n8n or the app) keeps the CRM in sync.
--
--   get_or_create_conversation(tenant_id, contact_id) -> conversation_id
--     Returns the conversation for a contact, creating it if missing. Call it
--     after resolving the contact so the n8n flow has a real conversation_id.
--
--   BEFORE INSERT trigger (messages_attach_conversation):
--     If a message has no conversation_id, it auto-creates/attaches the
--     conversation from (tenant_id, contact_id). n8n only needs to send
--     tenant_id + contact_id on the message row.
--
--   AFTER INSERT trigger (messages_touch_conversation):
--     Refreshes last_message_at / preview / direction, the 24h window
--     (inbound only), and unread_count (+1 inbound, reset to 0 on outbound).

CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_tenant_id  uuid,
  p_contact_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO conversations (tenant_id, contact_id, status, unread_count)
  VALUES (p_tenant_id, p_contact_id, 'open', 0)
  ON CONFLICT (tenant_id, contact_id) DO NOTHING;

  SELECT id INTO v_id
  FROM conversations
  WHERE tenant_id = p_tenant_id AND contact_id = p_contact_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_conversation(uuid, uuid)
  TO service_role, authenticated, anon;

CREATE OR REPLACE FUNCTION messages_attach_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.conversation_id IS NULL THEN
    IF NEW.tenant_id IS NULL OR NEW.contact_id IS NULL THEN
      RAISE EXCEPTION 'messages.conversation_id is null and tenant_id/contact_id missing — cannot auto-create conversation';
    END IF;
    NEW.conversation_id := get_or_create_conversation(NEW.tenant_id, NEW.contact_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_attach_conversation_trg ON messages;
CREATE TRIGGER messages_attach_conversation_trg
  BEFORE INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_attach_conversation();

CREATE OR REPLACE FUNCTION messages_touch_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview text;
  v_at      timestamptz := COALESCE(NEW.created_at, now());
BEGIN
  v_preview := COALESCE(
    NULLIF(left(NEW.content, 120), ''),
    CASE NEW.content_type
      WHEN 'image'    THEN '📷 Imagen'
      WHEN 'audio'    THEN '🎤 Audio'
      WHEN 'video'    THEN '🎬 Video'
      WHEN 'document' THEN '📄 Documento'
      WHEN 'sticker'  THEN 'Sticker'
      WHEN 'location' THEN '📍 Ubicación'
      ELSE NEW.content_type
    END
  );

  UPDATE conversations
  SET last_message_at        = v_at,
      last_message_preview   = v_preview,
      last_message_direction = NEW.direction,
      status                 = 'open',
      window_expires_at = CASE WHEN NEW.direction = 'inbound'
                               THEN v_at + interval '24 hours'
                               ELSE window_expires_at END,
      unread_count = CASE WHEN NEW.direction = 'inbound'
                          THEN unread_count + 1
                          ELSE 0 END
  WHERE id = NEW.conversation_id;

  -- Keep the contact's timestamps in sync — last_incoming_at drives the 24h window
  IF NEW.direction = 'inbound' THEN
    UPDATE contacts SET last_incoming_at = v_at, updated_at = now()
    WHERE id = NEW.contact_id;
  ELSE
    UPDATE contacts SET last_contacted_at = v_at, updated_at = now()
    WHERE id = NEW.contact_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS messages_touch_conversation_trg ON messages;
CREATE TRIGGER messages_touch_conversation_trg
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION messages_touch_conversation();
