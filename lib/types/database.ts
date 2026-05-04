export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// n8n Postgres Chat Memory message format
export type N8nMessage = {
  type: 'human' | 'ai' | 'tool'
  content: string
  // AI messages with tool calls
  tool_calls?: Array<{
    id: string
    name: string
    args: Record<string, unknown>
    type: 'tool_call'
  }>
  invalid_tool_calls?: unknown[]
  // Tool result messages
  name?: string
  // Alternative format used by follow-up/proactive messages
  data?: { content: string; additional_kwargs?: Record<string, unknown> }
  additional_kwargs?: Record<string, unknown>
  response_metadata?: Record<string, unknown>
}

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          plan: 'starter' | 'professional' | 'enterprise'
          is_active: boolean
          max_agents: number
          max_contacts: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      tenant_credentials: {
        Row: {
          id: string
          tenant_id: string
          // Meta WhatsApp
          waba_id: string | null
          phone_number_id: string | null
          meta_access_token: string | null
          meta_webhook_verify_token: string | null
          // n8n
          n8n_base_url: string | null
          n8n_webhook_secret: string | null
          // Google Calendar
          google_calendar_id: string | null
          google_service_account_json: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenant_credentials']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenant_credentials']['Insert']>
      }
      users: {
        Row: {
          id: string
          tenant_id: string
          full_name: string
          email: string
          avatar_url: string | null
          phone: string | null
          role: 'owner' | 'admin' | 'agent' | 'viewer'
          is_active: boolean
          last_seen_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      funnel_stages: {
        Row: {
          id: string
          tenant_id: string
          name: string
          slug: string
          color: string
          position: number
          is_won: boolean
          is_lost: boolean
          is_default: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['funnel_stages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['funnel_stages']['Insert']>
      }
      tags: {
        Row: {
          id: string
          tenant_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['tags']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['tags']['Insert']>
      }
      contacts: {
        Row: {
          id: string
          tenant_id: string
          first_name: string
          last_name: string | null
          phone: string | null
          email: string | null
          company: string | null
          job_title: string | null
          city: string | null
          country: string
          wa_id: string | null
          funnel_stage_id: string | null
          lead_score: number
          source: 'whatsapp' | 'web' | 'csv' | 'manual' | 'referral' | 'campaign'
          assigned_to: string | null
          ai_active: boolean
          last_incoming_at: string | null
          custom_fields: Json
          notes: string | null
          last_contacted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>
      }
      contact_tags: {
        Row: {
          contact_id: string
          tag_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['contact_tags']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['contact_tags']['Insert']>
      }
      conversations: {
        Row: {
          id: string
          tenant_id: string
          contact_id: string
          status: 'open' | 'resolved' | 'pending' | 'snoozed'
          ai_active: boolean
          assigned_agent_id: string | null
          window_expires_at: string | null
          unread_count: number
          last_message_at: string | null
          last_message_preview: string | null
          last_message_direction: 'inbound' | 'outbound' | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
      }
      n8n_chat_histories: {
        Row: {
          id: number
          session_id: string
          message: N8nMessage
          time_stamp: string
        }
        Insert: Omit<Database['public']['Tables']['n8n_chat_histories']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['n8n_chat_histories']['Insert']>
      }
      messages: {
        Row: {
          id: string
          tenant_id: string
          conversation_id: string
          contact_id: string
          content: string | null
          content_type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location' | 'template' | 'reaction'
          direction: 'inbound' | 'outbound'
          sender_type: 'contact' | 'agent' | 'bot' | 'system'
          sender_id: string | null
          media_url: string | null
          media_mime_type: string | null
          media_filename: string | null
          media_size_bytes: number | null
          wa_message_id: string | null
          delivery_status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }

      ai_actions: {
        Row: {
          id: string
          tenant_id: string
          conversation_id: string
          contact_id: string
          action_type: string
          tool_name: string | null
          status: 'success' | 'failure' | 'pending'
          summary: string
          details: Json | null
          reasoning: string | null
          stage_before: string | null
          stage_after: string | null
          data_captured: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ai_actions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['ai_actions']['Insert']>
      }
      appointments: {
        Row: {
          id: string
          tenant_id: string
          contact_id: string | null
          assigned_to: string | null
          title: string
          description: string | null
          location: string | null
          start_time: string
          end_time: string
          timezone: string
          status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled'
          google_event_id: string | null
          google_calendar_id: string | null
          google_meet_link: string | null
          created_by: 'bot' | 'manual' | 'import'
          created_by_user_id: string | null
          notes: string | null
          reminder_sent: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>
      }
      hsm_templates: {
        Row: {
          id: string
          tenant_id: string
          meta_template_id: string
          name: string
          language: string
          category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
          status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED'
          header_type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'NONE' | null
          header_text: string | null
          body_text: string
          footer_text: string | null
          buttons: Json | null
          variables_count: number
          example_values: Json | null
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['hsm_templates']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['hsm_templates']['Insert']>
      }
      campaigns: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          template_id: string | null
          template_name: string | null
          template_language: string | null
          template_body: string | null
          template_variables_count: number
          template_variables: Json | null
          variable_mappings: string[] | null
          segment_filters: Json | null
          target_count: number
          sent_count: number
          delivered_count: number
          read_count: number
          replied_count: number
          failed_count: number
          status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed' | 'cancelled'
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['campaigns']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>
      }
      campaign_messages: {
        Row: {
          id: string
          campaign_id: string
          contact_id: string
          tenant_id: string | null
          status: 'pending' | 'sent' | 'delivered' | 'read' | 'replied' | 'failed'
          wa_message_id: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          replied_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['campaign_messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['campaign_messages']['Insert']>
      }
      phase_transitions: {
        Row: {
          id: string
          tenant_id: string
          contact_id: string
          previous_stage_id: string | null
          new_stage_id: string | null
          previous_stage_name: string | null
          new_stage_name: string | null
          reason: 'automatic' | 'manual' | 'bot' | 'campaign'
          trigger_description: string | null
          changed_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['phase_transitions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['phase_transitions']['Insert']>
      }
      activity_log: {
        Row: {
          id: string
          tenant_id: string
          contact_id: string
          activity_type: string
          channel: 'whatsapp' | 'system' | 'manual' | 'bot'
          description: string
          metadata: Json | null
          performed_by: string | null
          performed_by_name: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
      }
      daily_metrics: {
        Row: {
          id: string
          tenant_id: string
          date: string
          conversations_total: number
          conversations_new: number
          conversations_resolved: number
          messages_inbound: number
          messages_outbound: number
          messages_by_bot: number
          messages_by_human: number
          bot_response_avg_seconds: number | null
          bot_handoff_count: number
          leads_new: number
          leads_qualified: number
          leads_won: number
          leads_lost: number
          appointments_booked: number
          appointments_completed: number
          appointments_no_show: number
          campaigns_sent: number
          campaigns_delivered: number
          campaigns_read: number
          campaigns_replied: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['daily_metrics']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['daily_metrics']['Insert']>
      }
      contact_notes: {
        Row: {
          id: string
          tenant_id: string
          contact_id: string
          content: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['contact_notes']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['contact_notes']['Insert']>
      }
      canned_responses: {
        Row: {
          id: string
          tenant_id: string
          title: string
          shortcut: string
          content: string
          category: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['canned_responses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['canned_responses']['Insert']>
      }
      custom_field_definitions: {
        Row: {
          id: string
          tenant_id: string
          field_key: string
          label: string
          field_type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'url' | 'email' | 'phone'
          options: Json | null
          is_required: boolean
          position: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['custom_field_definitions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['custom_field_definitions']['Insert']>
      }
    }
    Functions: {
      get_user_tenant_id: { Args: Record<never, never>; Returns: string }
      get_user_role: { Args: Record<never, never>; Returns: string }
    }
  }
}

// Convenience types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type Tenant = Tables<'tenants'>
export type TenantCredentials = Tables<'tenant_credentials'>
export type User = Tables<'users'>
export type FunnelStage = Tables<'funnel_stages'>
export type Tag = Tables<'tags'>
export type Contact = Tables<'contacts'>
export type ContactTag = Tables<'contact_tags'>
export type Conversation = Tables<'conversations'>
export type AIAction = Tables<'ai_actions'>
export type Appointment = Tables<'appointments'>
export type HSMTemplate = Tables<'hsm_templates'>
export type Campaign = Tables<'campaigns'>
export type CampaignMessage = Tables<'campaign_messages'>
export type PhaseTransition = Tables<'phase_transitions'>
export type ActivityLog = Tables<'activity_log'>
export type DailyMetrics = Tables<'daily_metrics'>
export type ContactNote = Tables<'contact_notes'>
export type CannedResponse = Tables<'canned_responses'>
export type CustomFieldDefinition = Tables<'custom_field_definitions'>
export type N8nChatHistory = Tables<'n8n_chat_histories'>
export type Message = Tables<'messages'>

// Extended types with joins
export type ContactWithDetails = Contact & {
  funnel_stage?: FunnelStage | null
  tags?: Tag[]
  assigned_user?: User | null
}

export type ContactForConversation = Contact & {
  funnel_stage?: FunnelStage | null
  tags?: Tag[]
}

export type ConversationWithContact = Conversation & {
  contact: ContactForConversation
  assigned_agent?: User | null
}

