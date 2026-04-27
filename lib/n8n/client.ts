import { config } from '@/lib/config'

export class N8nWebhookClient {
  private baseUrl: string
  private secret: string

  constructor() {
    this.baseUrl = config.n8n.baseUrl.replace(/\/$/, '')
    this.secret = config.n8n.webhookSecret
  }

  private sign(body: string): string {
    const crypto = require('crypto')
    return crypto.createHmac('sha256', this.secret).update(body).digest('hex')
  }

  async post(path: string, payload: unknown): Promise<Response> {
    const body = JSON.stringify(payload)
    const signature = this.sign(body)

    return fetch(`${this.baseUrl}/webhook/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
    })
  }
}

export const n8nClient = new N8nWebhookClient()
