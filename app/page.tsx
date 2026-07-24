import { redirect } from 'next/navigation'

export default function RootPage() {
  // El embudo (vista kanban de contactos) es la página principal del CRM.
  redirect('/contacts')
}
