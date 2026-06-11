export const config = {
  n8n: {
    baseUrl: process.env.N8N_BASE_URL ?? 'http://localhost:5678',
    webhookSecret: process.env.N8N_WEBHOOK_SECRET ?? '',
  },
  meta: {
    wabaId: process.env.META_WABA_ID ?? '',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? '',
    accessToken: process.env.META_ACCESS_TOKEN ?? '',
    webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? '',
  },
  google: {
    calendarId: process.env.GOOGLE_CALENDAR_ID ?? 'primary',
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? '',
  },
  // Emails that are auto-registered as super admins on sign-up (comma-separated).
  superAdminEmails: (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
} as const

export type Config = typeof config
