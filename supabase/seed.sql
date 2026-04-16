-- ================================================================
-- SEED DATA — TuContador CRM Dev
-- Run AFTER schema.sql
-- ================================================================

-- 1. Tenant
INSERT INTO tenants (id, name, slug, plan) VALUES
  ('11111111-1111-1111-1111-111111111111', 'TuContador Demo', 'tucontador-demo', 'professional')
ON CONFLICT (slug) DO NOTHING;

-- 2. Tenant credentials (empty, fill via Settings > Integrations)
INSERT INTO tenant_credentials (tenant_id)
  VALUES ('11111111-1111-1111-1111-111111111111')
ON CONFLICT (tenant_id) DO NOTHING;

-- 3. Funnel stages
INSERT INTO funnel_stages (tenant_id, name, slug, color, position, is_default) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Nuevo', 'nuevo', '#6366f1', 0, true),
  ('11111111-1111-1111-1111-111111111111', 'Contactado', 'contactado', '#f59e0b', 1, false),
  ('11111111-1111-1111-1111-111111111111', 'Interesado', 'interesado', '#10b981', 2, false),
  ('11111111-1111-1111-1111-111111111111', 'Propuesta enviada', 'propuesta', '#8b5cf6', 3, false),
  ('11111111-1111-1111-1111-111111111111', 'Negociación', 'negociacion', '#ec4899', 4, false),
  ('11111111-1111-1111-1111-111111111111', 'Ganado', 'ganado', '#22c55e', 5, false),
  ('11111111-1111-1111-1111-111111111111', 'Perdido', 'perdido', '#ef4444', 6, false)
ON CONFLICT (tenant_id, slug) DO NOTHING;

-- 4. Tags
INSERT INTO tags (tenant_id, name, color) VALUES
  ('11111111-1111-1111-1111-111111111111', 'VIP', '#f59e0b'),
  ('11111111-1111-1111-1111-111111111111', 'Pyme', '#6366f1'),
  ('11111111-1111-1111-1111-111111111111', 'Referido', '#10b981'),
  ('11111111-1111-1111-1111-111111111111', 'Caliente', '#ef4444'),
  ('11111111-1111-1111-1111-111111111111', 'Importado', '#94a3b8')
ON CONFLICT (tenant_id, name) DO NOTHING;
