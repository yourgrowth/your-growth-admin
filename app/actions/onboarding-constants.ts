export const ONBOARDING_STEPS = [
  'welcome', 'create_profile', 'first_habit', 'set_goal',
  'nutrition_setup', 'gardener_intro', 'first_completion', 'pro_upsell', 'complete',
]

export type StepStat = {
  step: string
  reached: number
  completedCount: number
  avgTimeSeconds: number
}

export type DroppedUser = {
  id: string
  display_name: string | null
  email: string | null
  subscription_status: string | null
  created_at: string
}

export type TimeStatRow = { step: string; avgSeconds: number }

export type CohortWeek = { week: string; label: string; userIds: string[] }
