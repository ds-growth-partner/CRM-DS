import { createHmac } from 'node:crypto'
import { config } from '@/lib/config'
import { createAdminClient } from '@/lib/supabase/admin'

export class N8nWebhookClient {
  private baseUrl: string
  private secret: string

  constructor(baseUrl: string, secret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.secret = secret
  }

  private sign(body: string): string {
    return createHmac('sha256', this.secret).update(body).digest('hex')
  }

  async post(path: string, payload: unknown): Promise<Response> {
    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (this.secret) {
      headers['X-Webhook-Signature'] = this.sign(body)
    }

    return fetch(`${this.baseUrl}/webhook/${path}`, {
      method: 'POST',
      headers,
      body,
    })
  }
}

// Global fallback client built from env vars. Used only when a tenant has no
// n8n_base_url configured in tenant_credentials.
export const n8nClient = new N8nWebhookClient(config.n8n.baseUrl, config.n8n.webhookSecret)

/**
 * Returns an N8nWebhookClient pointed at the *tenant's own* n8n instance,
 * reading `n8n_base_url` + `n8n_webhook_secret` from tenant_credentials.
 *
 * This is what makes the CRM multi-tenant: each client's webhooks fire against
 * their own n8n. Configure it per tenant in /admin or settings/integrations —
 * the only thing that needs to change per client is the URL + secret.
 *
 * Falls back to the env-var client if the tenant has no n8n configured yet.
 */
export async function getN8nClientForTenant(tenantId: string): Promise<N8nWebhookClient> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenant_credentials')
    .select('n8n_base_url, n8n_webhook_secret')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const baseUrl = data?.n8n_base_url?.trim()
  if (!baseUrl) {
    console.warn(
      `[n8n] Tenant ${tenantId} has no n8n_base_url configured — falling back to global N8N_BASE_URL`
    )
    return n8nClient
  }

  return new N8nWebhookClient(baseUrl, data?.n8n_webhook_secret ?? '')
}
