import { ContactDetailView } from '@/components/contacts/contact-detail-view'

interface Props {
  params: Promise<{ contactId: string }>
}

export default async function ContactDetailPage({ params }: Props) {
  const { contactId } = await params
  return <ContactDetailView contactId={contactId} />
}
