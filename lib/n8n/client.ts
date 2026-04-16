import crypto from 'crypto'

export class N8nWebhookClient {
  private baseUrl: string
  private secret: string

  constructor(baseUrl: string, secret: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.secret = secret
  }

  private sign(body: string): string {
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
