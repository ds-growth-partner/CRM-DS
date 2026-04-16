export type ApiResponse<T> = {
  data: T | null
  error: string | null
}

export type PaginatedResponse<T> = {
  data: T[]
  count: number
  page: number
  pageSize: number
}

export type ConversationFilters = {
  status?: 'open' | 'resolved' | 'pending' | 'snoozed'
  ai_active?: boolean
  assigned_to?: string
  search?: string
}

export type ContactFilters = {
  funnel_stage_id?: string
  tag_id?: string
  lead_score_min?: number
  lead_score_max?: number
  source?: string
  assigned_to?: string
  ai_active?: boolean
  created_from?: string
  created_to?: string
  search?: string
}

export type SendMessagePayload = {
  conversation_id: string
  contact_id: string
  wa_id: string
  message: {
    type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template'
    content?: string
    media_url?: string
    caption?: string
    template_name?: string
    language?: string
    components?: unknown[]
  }
}

export type TakeControlPayload = {
  conversation_id: string
  contact_id: string
  action: 'take_control' | 'release_control'
  reason?: string
}

export type MoveStagePayload = {
  contact_id: string
  previous_stage_id: string | null
  new_stage_id: string
  previous_stage_name?: string
  new_stage_name?: string
  reason: 'manual'
}

export type CalendarEventPayload = {
  action: 'create' | 'update' | 'cancel'
  appointment: {
    id?: string
    title: string
    description?: string
    contact_id?: string
    assigned_to?: string
    start_time: string
    end_time: string
    timezone: string
    location?: string
    create_google_meet?: boolean
    google_event_id?: string
  }
  google_calendar_id?: string
}
