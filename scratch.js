const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
async function main() {
  const { data: user } = await admin.from('users').select('*').limit(1).single()
  console.log("User:", user?.id, "Tenant:", user?.tenant_id)
  
  if (!user) return console.log("No user")
  
  const payload = {
      tenant_id: user.tenant_id,
      title: "Test Appointment",
      description: "Test Desc",
      contact_id: null,
      assigned_to: user.id,
      start_time: "2026-04-24T12:00:00.000Z",
      end_time: "2026-04-24T13:00:00.000Z",
      timezone: "America/Bogota",
      location: "Google Meet",
      created_by: "manual",
      created_by_user_id: user.id,
  }
  
  const res = await admin.from('appointments').insert(payload).select().single()
  console.log("Insert response:", res)
}
main()
