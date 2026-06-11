export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Profile = {
  id: string
  email: string | null
  // Real bonsai-app column names
  display_name: string | null
  subscription_status: string | null
  total_points: number | null
  bonsai_stage: number | null
  onboarding_complete: boolean | null
  last_opened_at: string | null
  avatar_url: string | null
  goals: string[] | null
  struggles: string[] | null
  timezone: string | null
  // Legacy column names kept for backward compat (admin pages reference these)
  full_name: string | null
  username: string | null
  plan: string | null
  stage: string | null
  streak: number | null
  points: number | null
  status: string | null
  is_admin: boolean | null
  warnings: number | null
  country: string | null
  country_code: string | null
  appeal_status: string | null
  created_at: string
  updated_at: string | null
  last_sign_in_at: string | null
  last_active_at: string | null
  ai_calls_used_this_month: number | null
}

export type UserCommunication = {
  id: string
  user_id: string
  type: string
  subject: string | null
  body: string | null
  sent_at: string
  sent_by: string | null
}

export type UserWarning = {
  id: string
  user_id: string
  reason: string
  severity: string
  issued_by: string | null
  issued_at: string
  resolved: boolean | null
  resolved_at: string | null
}

export type PointsHistoryEntry = {
  id: string
  user_id: string
  amount: number
  reason: string | null
  admin_id: string | null
  created_at: string
}

export type Habit = {
  id: string
  user_id: string
  name: string
  category: string | null
  created_at: string
}

export type HabitCompletion = {
  id: string
  habit_id: string
  user_id: string
  completed_at: string
}

export type Goal = {
  id: string
  user_id: string
  title: string
  category: string | null
  progress: number | null
  status: string | null
  gardener_linked: boolean | null
  created_at: string
}

export type GardenerSummary = {
  id: string
  user_id: string
  summary: string | null
  phase: string | null
  prompt_version: string | null
  flagged: boolean | null
  quality_score: number | null
  created_at: string
}

export type MealSuggestion = {
  id: string
  user_id: string
  suggestion: string | null
  dislikes: string | null
  swaps: string | null
  flagged: boolean | null
  created_at: string
}

export type GrowthBibleVideo = {
  id: string
  topic_id: string | null
  title: string
  description: string | null
  mux_playback_id: string | null
  mux_asset_id: string | null
  duration_seconds: number | null
  thumbnail_url: string | null
  sort_order: number | null
  is_free: boolean | null
  is_published: boolean | null
  tags: string[] | null
  created_at: string
}

export type VideoWatchHistory = {
  id: string
  user_id: string | null
  video_id: string | null
  topic_id: string | null
  watched_at: string
  watch_duration_seconds: number | null
  completed: boolean | null
  date: string | null
}

export type VideoWatchEvent = {
  id: string
  user_id: string | null
  video_id: string | null
  watch_percentage: number | null
  watched_at: string
}

export type Playlist = {
  id: string
  name: string
  video_ids: string[]
  created_at: string
}

export type ContentAbTest = {
  id: string
  video_id: string | null
  variant_a_title: string
  variant_b_title: string
  variant_a_views: number
  variant_b_views: number
  status: string
  created_at: string
}

export type NotificationLog = {
  id: string
  title: string
  body: string | null
  segment: string | null
  sent_at: string
  open_count: number | null
}

export type FeatureFlag = {
  id: string
  key: string
  label: string | null
  enabled: boolean
  scope: string | null
}

export type LoginAttempt = {
  id: string
  ip_address: string
  email: string | null
  success: boolean
  attempted_at: string
}

export type AdminLoginLog = {
  id: string
  admin_id: string | null
  ip_address: string | null
  user_agent: string | null
  logged_in_at: string
  logged_out_at: string | null
}

export type AdminAuditLog = {
  id: string
  admin_id: string
  action: string
  target_user_id: string | null
  metadata: Json | null
  created_at: string
}

export type JournalEntry = {
  id: string
  user_id: string
  content: string | null
  mood_score: number | null
  flagged: boolean | null
  created_at: string
}

export type AppError = {
  id: string
  error_type: string | null
  message: string | null
  stack: string | null
  user_id: string | null
  edge_function: string | null
  created_at: string
  resolved: boolean | null
}

export type EdgeFunctionLog = {
  id: string
  function_name: string | null
  status: string | null
  duration_ms: number | null
  error_message: string | null
  user_id: string | null
  created_at: string
}

export type ServiceIncident = {
  id: string
  service_name: string | null
  description: string | null
  started_at: string
  resolved_at: string | null
}

export type SupportTicket = {
  id: string
  user_id: string | null
  subject: string | null
  description: string | null
  status: string
  priority: string
  assigned_to: string | null
  created_at: string
  resolved_at: string | null
}

export type TicketReply = {
  id: string
  ticket_id: string | null
  sender_id: string | null
  body: string | null
  is_admin: boolean
  created_at: string
}

export type OnboardingEvent = {
  id: string
  user_id: string | null
  step: string
  completed: boolean | null
  skipped: boolean | null
  time_spent_seconds: number | null
  created_at: string
}

export type GoalNote = {
  id: string
  goal_id: string | null
  note: string | null
  admin_id: string | null
  created_at: string
}

export type AdminNote = {
  id: string
  user_id: string | null
  note: string | null
  admin_id: string | null
  created_at: string
}

export type PromptVersion = {
  id: string
  version_label: string
  prompt_text: string
  created_by: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: { id: string; email?: string | null; display_name?: string | null; subscription_status?: string | null; full_name?: string | null; username?: string | null; plan?: string | null; stage?: string | null; streak?: number | null; points?: number | null; total_points?: number | null; bonsai_stage?: number | null; status?: string | null; is_admin?: boolean | null; warnings?: number | null; country?: string | null; country_code?: string | null; appeal_status?: string | null; created_at?: string; last_sign_in_at?: string | null; last_active_at?: string | null; last_opened_at?: string | null; ai_calls_used_this_month?: number | null }
        Update: Partial<Profile>
        Relationships: []
      }
      habits: {
        Row: Habit
        Insert: { id?: string; user_id: string; name: string; category?: string | null; created_at?: string }
        Update: Partial<Habit>
        Relationships: []
      }
      habit_completions: {
        Row: HabitCompletion
        Insert: { id?: string; habit_id: string; user_id: string; completed_at?: string }
        Update: Partial<HabitCompletion>
        Relationships: []
      }
      goals: {
        Row: Goal
        Insert: { id?: string; user_id: string; title: string; category?: string | null; progress?: number | null; status?: string | null; gardener_linked?: boolean | null; created_at?: string }
        Update: Partial<Goal>
        Relationships: []
      }
      gardener_summaries: {
        Row: GardenerSummary
        Insert: { id?: string; user_id: string; summary?: string | null; phase?: string | null; prompt_version?: string | null; flagged?: boolean | null; created_at?: string }
        Update: Partial<GardenerSummary>
        Relationships: []
      }
      meal_suggestions: {
        Row: MealSuggestion
        Insert: { id?: string; user_id: string; suggestion?: string | null; dislikes?: string | null; swaps?: string | null; flagged?: boolean | null; created_at?: string }
        Update: Partial<MealSuggestion>
        Relationships: []
      }
      growth_bible_videos: {
        Row: GrowthBibleVideo
        Insert: { id?: string; topic_id?: string | null; title: string; description?: string | null; mux_playback_id?: string | null; mux_asset_id?: string | null; duration_seconds?: number | null; thumbnail_url?: string | null; sort_order?: number | null; is_free?: boolean | null; is_published?: boolean | null; tags?: string[] | null; created_at?: string }
        Update: Partial<GrowthBibleVideo>
        Relationships: []
      }
      video_watch_history: {
        Row: VideoWatchHistory
        Insert: { id?: string; user_id?: string | null; video_id?: string | null; topic_id?: string | null; watched_at?: string; watch_duration_seconds?: number | null; completed?: boolean | null; date?: string | null }
        Update: Partial<VideoWatchHistory>
        Relationships: []
      }
      video_watch_events: {
        Row: VideoWatchEvent
        Insert: { id?: string; user_id?: string | null; video_id?: string | null; watch_percentage?: number | null; watched_at?: string }
        Update: Partial<VideoWatchEvent>
        Relationships: []
      }
      playlists: {
        Row: Playlist
        Insert: { id?: string; name: string; video_ids?: string[]; created_at?: string }
        Update: Partial<Playlist>
        Relationships: []
      }
      content_ab_tests: {
        Row: ContentAbTest
        Insert: { id?: string; video_id?: string | null; variant_a_title: string; variant_b_title: string; variant_a_views?: number; variant_b_views?: number; status?: string; created_at?: string }
        Update: Partial<ContentAbTest>
        Relationships: []
      }
      notifications_log: {
        Row: NotificationLog
        Insert: { id?: string; title: string; body?: string | null; segment?: string | null; sent_at?: string; open_count?: number | null }
        Update: Partial<NotificationLog>
        Relationships: []
      }
      feature_flags: {
        Row: FeatureFlag
        Insert: { id?: string; key: string; label?: string | null; enabled?: boolean; scope?: string | null }
        Update: Partial<FeatureFlag>
        Relationships: []
      }
      login_attempts: {
        Row: LoginAttempt
        Insert: { id?: string; ip_address: string; email?: string | null; success?: boolean; attempted_at?: string }
        Update: Partial<LoginAttempt>
        Relationships: []
      }
      admin_login_log: {
        Row: AdminLoginLog
        Insert: { id?: string; admin_id?: string | null; ip_address?: string | null; user_agent?: string | null; logged_in_at?: string; logged_out_at?: string | null }
        Update: Partial<AdminLoginLog>
        Relationships: []
      }
      admin_audit_log: {
        Row: AdminAuditLog
        Insert: { id?: string; admin_id: string; action: string; target_user_id?: string | null; metadata?: Json | null; created_at?: string }
        Update: Partial<AdminAuditLog>
        Relationships: []
      }
      journal_entries: {
        Row: JournalEntry
        Insert: { id?: string; user_id: string; content?: string | null; mood_score?: number | null; flagged?: boolean | null; created_at?: string }
        Update: Partial<JournalEntry>
        Relationships: []
      }
      user_communications: {
        Row: UserCommunication
        Insert: { id?: string; user_id: string; type: string; subject?: string | null; body?: string | null; sent_at?: string; sent_by?: string | null }
        Update: Partial<UserCommunication>
        Relationships: []
      }
      user_warnings: {
        Row: UserWarning
        Insert: { id?: string; user_id: string; reason: string; severity: string; issued_by?: string | null; issued_at?: string; resolved?: boolean | null; resolved_at?: string | null }
        Update: Partial<UserWarning>
        Relationships: []
      }
      points_history: {
        Row: PointsHistoryEntry
        Insert: { id?: string; user_id: string; amount: number; reason?: string | null; admin_id?: string | null; created_at?: string }
        Update: Partial<PointsHistoryEntry>
        Relationships: []
      }
      completions: {
        Row: { id: string; user_id: string; habit_id: string | null; completed_at: string; points_awarded: number | null; date: string | null }
        Insert: { id?: string; user_id: string; habit_id?: string | null; completed_at?: string; points_awarded?: number | null; date?: string | null }
        Update: { user_id?: string; habit_id?: string | null; completed_at?: string }
        Relationships: []
      }
      food_logs: {
        Row: { id: string; user_id: string; food_name: string | null; calories: number | null; protein: number | null; carbohydrates: number | null; fat: number | null; date: string | null; created_at: string }
        Insert: { id?: string; user_id: string; food_name?: string | null; calories?: number | null; protein?: number | null; carbohydrates?: number | null; fat?: number | null; date?: string | null; created_at?: string }
        Update: Partial<{ user_id: string; food_name: string | null; calories: number | null; protein: number | null; carbohydrates: number | null; fat: number | null; date: string | null }>
        Relationships: []
      }
      water_logs: {
        Row: { id: string; user_id: string; ml: number | null; goal_ml: number | null; glasses: number | null; date: string | null; created_at: string }
        Insert: { id?: string; user_id: string; ml?: number | null; goal_ml?: number | null; glasses?: number | null; date?: string | null }
        Update: Partial<{ ml: number | null; goal_ml: number | null }>
        Relationships: []
      }
      body_logs: {
        Row: { id: string; user_id: string; weight: number | null; weight_unit: string | null; energy_level: number | null; mood: number | null; created_at: string; date: string | null }
        Insert: { id?: string; user_id: string; weight?: number | null; weight_unit?: string | null; created_at?: string }
        Update: Partial<{ weight: number | null; weight_unit: string | null }>
        Relationships: []
      }
      gardener_profiles: {
        Row: { id: string; user_id: string; phase: string | null; last_tone: string | null; days_since_signup: number | null; updated_at: string }
        Insert: { id?: string; user_id: string; phase?: string | null; last_tone?: string | null }
        Update: { phase?: string | null; last_tone?: string | null }
        Relationships: []
      }
      app_errors: {
        Row: AppError
        Insert: { id?: string; error_type?: string | null; message?: string | null; stack?: string | null; user_id?: string | null; edge_function?: string | null; created_at?: string; resolved?: boolean | null }
        Update: { resolved?: boolean | null }
        Relationships: []
      }
      edge_function_logs: {
        Row: EdgeFunctionLog
        Insert: { id?: string; function_name?: string | null; status?: string | null; duration_ms?: number | null; error_message?: string | null; user_id?: string | null; created_at?: string }
        Update: Partial<EdgeFunctionLog>
        Relationships: []
      }
      service_incidents: {
        Row: ServiceIncident
        Insert: { id?: string; service_name?: string | null; description?: string | null; started_at?: string; resolved_at?: string | null }
        Update: { resolved_at?: string | null }
        Relationships: []
      }
      support_tickets: {
        Row: SupportTicket
        Insert: { id?: string; user_id?: string | null; subject?: string | null; description?: string | null; status?: string; priority?: string; assigned_to?: string | null; created_at?: string; resolved_at?: string | null }
        Update: { status?: string; priority?: string; assigned_to?: string | null; resolved_at?: string | null }
        Relationships: []
      }
      ticket_replies: {
        Row: TicketReply
        Insert: { id?: string; ticket_id?: string | null; sender_id?: string | null; body?: string | null; is_admin?: boolean; created_at?: string }
        Update: Partial<TicketReply>
        Relationships: []
      }
      onboarding_events: {
        Row: OnboardingEvent
        Insert: { id?: string; user_id?: string | null; step: string; completed?: boolean | null; skipped?: boolean | null; time_spent_seconds?: number | null; created_at?: string }
        Update: Partial<OnboardingEvent>
        Relationships: []
      }
      goal_notes: {
        Row: GoalNote
        Insert: { id?: string; goal_id?: string | null; note?: string | null; admin_id?: string | null; created_at?: string }
        Update: Partial<GoalNote>
        Relationships: []
      }
      admin_notes: {
        Row: AdminNote
        Insert: { id?: string; user_id?: string | null; note?: string | null; admin_id?: string | null; created_at?: string }
        Update: Partial<AdminNote>
        Relationships: []
      }
      prompt_versions: {
        Row: PromptVersion
        Insert: { id?: string; version_label: string; prompt_text: string; created_by?: string | null; created_at?: string }
        Update: Partial<PromptVersion>
        Relationships: []
      }
      prompt_config: {
        Row: { id: number; active_version: string | null; updated_at: string }
        Insert: { id?: number; active_version?: string | null; updated_at?: string }
        Update: { active_version?: string | null; updated_at?: string }
        Relationships: []
      }
      ai_usage_log: {
        Row: { id: string; user_id: string | null; feature: string; model: string; input_tokens: number | null; output_tokens: number | null; error: string | null; duration_ms: number | null; created_at: string }
        Insert: { id?: string; user_id?: string | null; feature: string; model: string; input_tokens?: number | null; output_tokens?: number | null; error?: string | null; duration_ms?: number | null; created_at?: string }
        Update: Partial<{ feature: string; model: string; input_tokens: number | null; output_tokens: number | null }>
        Relationships: []
      }
      gardener_chat_sessions: {
        Row: { id: string; user_id: string; started_at: string; ended_at: string | null; message_count: number | null; safety_flags: number | null }
        Insert: { id?: string; user_id: string; started_at?: string; ended_at?: string | null; message_count?: number | null; safety_flags?: number | null }
        Update: Partial<{ ended_at: string | null; message_count: number | null }>
        Relationships: []
      }
      gardener_chat_messages: {
        Row: { id: string; session_id: string; user_id: string; role: string; content: string; created_at: string; safety_flagged: boolean | null; flagged_reason: string | null; response_ms: number | null }
        Insert: { id?: string; session_id: string; user_id: string; role: string; content: string; created_at?: string; safety_flagged?: boolean | null; flagged_reason?: string | null; response_ms?: number | null }
        Update: Partial<{ safety_flagged: boolean | null; flagged_reason: string | null; response_ms: number | null }>
        Relationships: []
      }
      safety_flag_log: {
        Row: { id: string; user_id: string | null; session_id: string | null; layer: string | null; layer_caught: string | null; action: string | null; trigger_text: string | null; trigger_type: string | null; input_snippet: string | null; response_given: string | null; original_response: string | null; source: string | null; action_taken: string | null; reviewed_at: string | null; reviewed_by: string | null; created_at: string }
        Insert: { id?: string; user_id?: string | null; session_id?: string | null; layer?: string | null; layer_caught?: string | null; action?: string | null; trigger_text?: string | null; trigger_type?: string | null; input_snippet?: string | null; response_given?: string | null; original_response?: string | null; source?: string | null; action_taken?: string | null; reviewed_at?: string | null; reviewed_by?: string | null; created_at?: string }
        Update: Partial<{ reviewed_at: string | null; reviewed_by: string | null; action_taken: string | null }>
        Relationships: []
      }
      gardener_context_snapshots: {
        Row: { id: string; user_id: string; snapshot_json: Json; created_at: string; generated_at: string | null; expires_at: string | null; data_confidence_score: number | null }
        Insert: { id?: string; user_id: string; snapshot_json: Json; created_at?: string; generated_at?: string | null; expires_at?: string | null; data_confidence_score?: number | null }
        Update: Partial<{ snapshot_json: Json; expires_at: string | null; data_confidence_score: number | null }>
        Relationships: []
      }
      daily_summaries: {
        Row: { id: string; user_id: string; date: string; summary_text: string | null; greeting: string | null; pattern_text: string | null; intention_text: string | null; created_at: string; habits_completed: number | null; habits_total: number | null; calories_consumed: number | null; calorie_goal_hit: boolean | null; videos_watched: number | null; progress_score: number | null; sections_json: Json | null; connections_json: Json | null; gardener_phase: string | null; voice_register: string | null; key_action: string | null }
        Insert: { id?: string; user_id: string; date: string; summary_text?: string | null; greeting?: string | null; pattern_text?: string | null; intention_text?: string | null; created_at?: string }
        Update: Partial<{ summary_text: string | null; greeting: string | null; pattern_text: string | null; intention_text: string | null }>
        Relationships: []
      }
      user_models: {
        Row: { id: string; user_id: string; voice_register: string | null; key_action_today: string | null; currently_returning: boolean | null; data_confidence_score: number | null; active_day_rate: number | null; total_active_days: number | null; updated_at: string }
        Insert: { id?: string; user_id: string; updated_at?: string }
        Update: Partial<{ voice_register: string | null; key_action_today: string | null; currently_returning: boolean | null; data_confidence_score: number | null; active_day_rate: number | null; total_active_days: number | null; updated_at: string }>
        Relationships: []
      }
    }
      page_views: {
        Row: { id: string; user_id: string | null; page_name: string | null; viewed_at: string; session_id: string | null }
        Insert: { id?: string; user_id?: string | null; page_name?: string | null; viewed_at?: string; session_id?: string | null }
        Update: Partial<{ page_name: string | null }>
        Relationships: []
      }
      sleep_logs: {
        Row: { id: string; user_id: string; date: string | null; bedtime: string | null; wake_time: string | null; duration_hours: number | null; quality: number | null; notes: string | null; created_at: string }
        Insert: { id?: string; user_id: string; date?: string | null; bedtime?: string | null; wake_time?: string | null; duration_hours?: number | null; quality?: number | null; notes?: string | null; created_at?: string }
        Update: Partial<{ bedtime: string | null; wake_time: string | null; duration_hours: number | null; quality: number | null; notes: string | null }>
        Relationships: []
      }
      food_quality_logs: {
        Row: { id: string; user_id: string; date: string | null; quality_score: number | null; whole_food_count: number | null; processed_food_count: number | null; high_additive_count: number | null; gardener_summary: string | null; created_at: string }
        Insert: { id?: string; user_id: string; date?: string | null; quality_score?: number | null; whole_food_count?: number | null; processed_food_count?: number | null; high_additive_count?: number | null; gardener_summary?: string | null; created_at?: string }
        Update: Partial<{ quality_score: number | null; gardener_summary: string | null }>
        Relationships: []
      }
      nutrition_cache: {
        Row: { id: string; barcode: string | null; search_key: string | null; nutriments: Json | null; source: string | null; completeness: number | null; created_at: string }
        Insert: { id?: string; barcode?: string | null; search_key?: string | null; nutriments?: Json | null; source?: string | null; completeness?: number | null; created_at?: string }
        Update: Partial<{ nutriments: Json | null; completeness: number | null }>
        Relationships: []
      }
      product_analyses: {
        Row: { id: string; barcode: string | null; additives: Json | null; overall_risk: string | null; summary: string | null; created_at: string }
        Insert: { id?: string; barcode?: string | null; additives?: Json | null; overall_risk?: string | null; summary?: string | null; created_at?: string }
        Update: Partial<{ additives: Json | null; overall_risk: string | null; summary: string | null }>
        Relationships: []
      }
      user_feature_flags: {
        Row: { id: string; user_id: string; flag_key: string; enabled: boolean; created_at: string }
        Insert: { id?: string; user_id: string; flag_key: string; enabled?: boolean; created_at?: string }
        Update: Partial<{ enabled: boolean }>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
