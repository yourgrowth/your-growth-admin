/**
 * Resource registry for the generic Data Control framework.
 *
 * Pure data (no functions, no imports) so it can be imported by BOTH server
 * action files and client components. Every table listed here gets a full
 * CRUD admin surface at `/data/<table>` via `ResourceManager`, and the server
 * actions in `app/actions/resources.ts` use this as a whitelist + the schema
 * for coercing values on write.
 *
 * Keep field `type` accurate — it drives both the editor control rendered and
 * how the value is coerced before hitting Postgres.
 */

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'json'
  | 'array'
  | 'select'
  | 'uuid'
  | 'ref'

export interface RefSpec {
  table: string
  labelFields: string[]
}

export interface Field {
  key: string
  label: string
  type: FieldType
  editable: boolean
  /** Show as a column in the table view. */
  inTable?: boolean
  /** Options for `select`. */
  options?: string[]
  /** Foreign-key target for `ref`. */
  ref?: RefSpec
}

export interface ResourceConfig {
  table: string
  label: string
  singular: string
  group: string
  description?: string
  primaryKey: string
  defaultSort: { key: string; dir: 'asc' | 'desc' }
  searchFields: string[]
  /** When true the table has a `user_id` column and gets a per-user filter. */
  userScoped: boolean
  creatable: boolean
  deletable: boolean
  fields: Field[]
}

// --- field factory helpers --------------------------------------------------
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const humanize = (key: string) =>
  key
    .replace(/_json$/, '')
    .replace(/_/g, ' ')
    .replace(/\bid\b/i, 'ID')
    .split(' ')
    .map((w) => (w === 'ID' ? w : cap(w)))
    .join(' ')

const id = (): Field => ({ key: 'id', label: 'ID', type: 'uuid', editable: false, inTable: false })
const userRef = (inTable = true): Field => ({
  key: 'user_id', label: 'User', type: 'ref', editable: true, inTable,
  ref: { table: 'profiles', labelFields: ['display_name', 'email'] },
})
const ts = (key: string, inTable = false): Field => ({ key, label: humanize(key), type: 'datetime', editable: false, inTable })
const text = (key: string, inTable = true): Field => ({ key, label: humanize(key), type: 'text', editable: true, inTable })
const long = (key: string, inTable = false): Field => ({ key, label: humanize(key), type: 'longtext', editable: true, inTable })
const num = (key: string, inTable = true): Field => ({ key, label: humanize(key), type: 'number', editable: true, inTable })
const bool = (key: string, inTable = true): Field => ({ key, label: humanize(key), type: 'boolean', editable: true, inTable })
const date = (key: string, inTable = true): Field => ({ key, label: humanize(key), type: 'date', editable: true, inTable })
const time = (key: string, inTable = true): Field => ({ key, label: humanize(key), type: 'time', editable: true, inTable })
const json = (key: string): Field => ({ key, label: humanize(key), type: 'json', editable: true, inTable: false })
const arr = (key: string): Field => ({ key, label: humanize(key), type: 'array', editable: true, inTable: false })
const sel = (key: string, options: string[], inTable = true): Field => ({ key, label: humanize(key), type: 'select', editable: true, inTable, options })
const ref = (key: string, table: string, labelFields: string[], inTable = true): Field => ({
  key, label: humanize(key.replace(/_id$/, '')), type: 'ref', editable: true, inTable, ref: { table, labelFields },
})

// --- groups (drive the hub + sidebar ordering) ------------------------------
export const RESOURCE_GROUPS = [
  'Mastery',
  'Gardener Intelligence',
  'Nutrition Data',
  'Sleep',
  'Goals Data',
] as const

export const RESOURCES: Record<string, ResourceConfig> = {
  // ====================================================== Mastery (raw tables)
  mastery_pillars: {
    table: 'mastery_pillars', label: 'Pillars', singular: 'Pillar', group: 'Mastery',
    description: 'The 9 authored Mastering Yourself pillars (founder content).',
    primaryKey: 'id', defaultSort: { key: 'sort_order', dir: 'asc' }, searchFields: ['name', 'slug', 'essence'],
    userScoped: false, creatable: true, deletable: true,
    fields: [
      id(), text('slug'), text('name'), long('essence', true), text('accent'),
      json('probing_questions'), json('opening_angle_bank'), num('sort_order'),
    ],
  },
  mastery_topics: {
    table: 'mastery_topics', label: 'Topics', singular: 'Topic', group: 'Mastery',
    description: 'Per-user mastery topics spawned within a pillar.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['title', 'summary'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), ref('pillar_id', 'mastery_pillars', ['name']), text('title'),
      sel('status', ['active', 'mastered']), long('summary'),
      sel('micro_tracker', ['sleep', 'energy', 'workout', 'water', 'mood', 'none']),
      ts('created_at', true), ts('last_reflected_at'), ts('mastered_at'),
    ],
  },
  mastery_tasks: {
    table: 'mastery_tasks', label: 'Tasks', singular: 'Task', group: 'Mastery',
    description: 'Behavioural / physical / observational tasks assigned in mastery sessions.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['body'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), ref('topic_id', 'mastery_topics', ['title']), long('body', true),
      sel('kind', ['behavioral', 'physical', 'observational']),
      sel('span', ['single_day', 'multi_day']),
      sel('status', ['suggested', 'active', 'done', 'dropped']),
      date('target_date'), ref('source_session_id', 'mastery_sessions', ['key_insight'], false),
      ts('created_at', true), ts('completed_at'),
    ],
  },
  mastery_sessions: {
    table: 'mastery_sessions', label: 'Sessions', singular: 'Session', group: 'Mastery',
    description: 'Reflection sessions. Read-mostly — generated by the app.',
    primaryKey: 'id', defaultSort: { key: 'started_at', dir: 'desc' }, searchFields: ['key_insight', 'summary'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), ref('pillar_id', 'mastery_pillars', ['name']),
      ref('topic_id', 'mastery_topics', ['title']), ts('started_at', true), ts('ended_at'),
      sel('end_reason', ['insight', 'user_done', 'cap']), num('depth_reached'),
      long('key_insight', true), long('summary'),
      ref('focus_task_id', 'mastery_tasks', ['body'], false),
      bool('is_onboarding', false), bool('is_revisit', false),
    ],
  },
  mastery_messages: {
    table: 'mastery_messages', label: 'Messages', singular: 'Message', group: 'Mastery',
    description: 'Every turn in a mastery session. Includes crisis-flag metadata.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['content'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), ref('session_id', 'mastery_sessions', ['key_insight'], false), userRef(false),
      sel('role', ['user', 'assistant']), long('content', true), num('rung'),
      bool('crisis_flagged'), ts('created_at', true),
    ],
  },
  mastery_insights: {
    table: 'mastery_insights', label: 'Insights', singular: 'Insight', group: 'Mastery',
    description: 'Beliefs, triggers, patterns and open threads surfaced about a user.',
    primaryKey: 'id', defaultSort: { key: 'surfaced_at', dir: 'desc' }, searchFields: ['content'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), ref('topic_id', 'mastery_topics', ['title']),
      ref('pillar_id', 'mastery_pillars', ['name']),
      sel('kind', ['belief', 'trigger', 'pattern', 'contradiction', 'open_thread']),
      long('content', true), bool('resolved'), ts('surfaced_at', true), ts('last_seen_at'),
    ],
  },
  mastery_daily_dump: {
    table: 'mastery_daily_dump', label: 'Daily Dump', singular: 'Daily Dump', group: 'Mastery',
    description: 'Free-text brain dumps routed to pillars.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['content'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), long('content', true), json('routed_pillar_ids'),
      ref('spawned_topic_id', 'mastery_topics', ['title'], false),
      ref('spawned_session_id', 'mastery_sessions', ['key_insight'], false), ts('created_at', true),
    ],
  },

  // ============================================== Gardener Intelligence engine
  user_models: {
    table: 'user_models', label: 'User Models', singular: 'User Model', group: 'Gardener Intelligence',
    description: 'The full computed intelligence model per user (all 18+ layers).',
    primaryKey: 'id', defaultSort: { key: 'updated_at', dir: 'desc' }, searchFields: ['phase', 'current_state'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), ts('updated_at', true), ts('computed_at'),
      num('data_confidence_overall'), num('data_confidence_habits', false), num('data_confidence_nutrition', false),
      num('data_confidence_energy', false), bool('minimum_viable_data', false), num('days_of_data'),
      text('phase'), num('consistency_score'), num('energy_score'), num('mood_trend', false),
      num('nutrition_adherence', false), num('hydration_score', false), num('goal_progress_rate', false),
      num('discipline_score', false), num('consistency_volatility', false), num('recovery_speed', false),
      num('behavioural_stability', false), num('goal_alignment_score', false),
      text('current_state'), num('state_confidence', false), date('state_since_date', false),
      text('previous_state', false), json('predictions_json'), num('dropout_risk'),
      num('engagement_probability', false), num('next_plateau_risk', false),
      num('momentum_score'), text('momentum_direction'), num('momentum_velocity', false),
      json('friction_points_json'), json('habit_anchors_json'), text('current_strategy'),
      num('strategy_confidence', false), long('strategy_reasoning'), json('identity_beliefs_json'),
      json('connections_json'), json('habit_dna_json'), json('nutrition_dna_json'), json('energy_dna_json'),
      json('reasoning_context_json'), json('what_works_json'), json('causal_chains_json'),
      json('identity_gaps_json'), json('trigger_response_json'), json('predictive_windows_json'),
      text('voice_register'), json('uncomfortable_truth_json'), long('key_action_today', true),
      bool('breakthrough_window', false), json('dashboard_spec_json'), json('weekly_correlations_json'),
      ts('correlations_computed_at'), bool('low_confidence', false), num('active_days_count'),
    ],
  },
  gardener_profiles: {
    table: 'gardener_profiles', label: 'Gardener Profiles', singular: 'Gardener Profile', group: 'Gardener Intelligence',
    description: 'Lightweight per-user Gardener state (phase, last tone, summary context).',
    primaryKey: 'id', defaultSort: { key: 'updated_at', dir: 'desc' }, searchFields: ['phase', 'last_tone'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), ts('updated_at', true), date('last_summary_date'), text('last_tone'),
      num('days_since_signup'), text('phase'), long('recent_summaries_context'),
    ],
  },
  gardener_context_snapshots: {
    table: 'gardener_context_snapshots', label: 'Context Snapshots', singular: 'Snapshot', group: 'Gardener Intelligence',
    description: 'Cached per-user context. Rebuilt daily; safe to delete to force a rebuild.',
    primaryKey: 'id', defaultSort: { key: 'generated_at', dir: 'desc' }, searchFields: [],
    userScoped: true, creatable: false, deletable: true,
    fields: [id(), userRef(), ts('generated_at', true), ts('expires_at', true), json('context_json'), ts('created_at')],
  },
  gardener_engagement_log: {
    table: 'gardener_engagement_log', label: 'Engagement Log', singular: 'Engagement', group: 'Gardener Intelligence',
    description: 'Which insight sections/correlations each user engaged with.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['section_engaged', 'correlation_key'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), date('session_date'), text('section_engaged'), text('insight_id', false),
      text('correlation_key'), bool('chat_triggered'), num('time_spent_seconds', false), ts('created_at', true),
    ],
  },
  gardener_tone_signals: {
    table: 'gardener_tone_signals', label: 'Tone Signals', singular: 'Tone Signal', group: 'Gardener Intelligence',
    description: 'Raw signals aggregated weekly into the user tone profile.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['signal_type', 'source'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), date('signal_date'), text('signal_type'), num('signal_value'), text('source'), ts('created_at', true),
    ],
  },
  gardener_insights_metadata: {
    table: 'gardener_insights_metadata', label: 'Insights Metadata', singular: 'Metadata Row', group: 'Gardener Intelligence',
    description: 'Audit log of every Gardener Insights generation (for algorithm iteration).',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['narrative_model', 'primary_focus_applied'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), date('summary_date'), json('correlations_shown'), json('correlation_confidence_scores'),
      arr('sections_rendered'), text('narrative_model'), text('correlation_model', false),
      num('tone_directness_applied', false), num('tone_data_weight_applied', false), text('primary_focus_applied'),
      bool('re_entry_mode', false), bool('had_enough_data', false), num('active_days_at_generation', false),
      bool('low_confidence_at_generation', false), ts('correlations_computed_at'), num('generation_duration_ms', false),
      ts('created_at', true),
    ],
  },
  strategy_decisions: {
    table: 'strategy_decisions', label: 'Strategy Decisions', singular: 'Strategy Decision', group: 'Gardener Intelligence',
    description: 'Each strategy the engine chose + its measured outcome (closed-loop learning).',
    primaryKey: 'id', defaultSort: { key: 'decided_at', dir: 'desc' }, searchFields: ['strategy_used', 'user_state_at_decision'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), ts('decided_at', true), text('strategy_used'), text('user_state_at_decision'),
      json('reasoning_context_snapshot'), ts('outcome_measured_at'), bool('outcome_positive'),
      bool('behaviour_change_detected', false), bool('user_followed_advice', false), num('effectiveness_score'),
    ],
  },
  pipeline_runs: {
    table: 'pipeline_runs', label: 'Pipeline Runs', singular: 'Pipeline Run', group: 'Gardener Intelligence',
    description: 'Nightly intelligence pipeline run log.',
    primaryKey: 'id', defaultSort: { key: 'started_at', dir: 'desc' }, searchFields: [],
    userScoped: false, creatable: false, deletable: true,
    fields: [
      id(), ts('started_at', true), ts('completed_at', true), num('users_processed'),
      num('duration_ms'), json('errors_json'),
    ],
  },

  // ================================================================ Nutrition
  meal_preps: {
    table: 'meal_preps', label: 'Meal Preps', singular: 'Meal Prep', group: 'Nutrition Data',
    description: 'Meal Prep Hub plans (draft/saved/active).',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['title', 'status'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), text('title'), sel('status', ['draft', 'saved']), bool('is_active'),
      json('params'), ts('created_at', true), ts('updated_at'),
    ],
  },
  meal_prep_items: {
    table: 'meal_prep_items', label: 'Meal Prep Items', singular: 'Prep Item', group: 'Nutrition Data',
    description: 'Individual meals within a prep plan (per day + slot).',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['slot', 'source'],
    userScoped: false, creatable: true, deletable: true,
    fields: [
      id(), ref('prep_id', 'meal_preps', ['title']), num('day_index'), text('slot'),
      json('meal'), bool('is_locked'), text('source'), bool('logged'), ts('created_at', true),
    ],
  },
  user_taste_profile: {
    table: 'user_taste_profile', label: 'Taste Profiles', singular: 'Taste Profile', group: 'Nutrition Data',
    description: 'Learned food preferences per user (PK is user_id).',
    primaryKey: 'user_id', defaultSort: { key: 'updated_at', dir: 'desc' }, searchFields: [],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      userRef(), json('preferred_cuisines'), json('preferred_ingredients'), json('avoided_ingredients'),
      json('protein_lean'), num('prep_time_tolerance_min'), json('macro_skew'), json('signal_counts'),
      ts('updated_at', true),
    ],
  },
  disliked_meals: {
    table: 'disliked_meals', label: 'Disliked Meals', singular: 'Disliked Meal', group: 'Nutrition Data',
    description: 'Meals a user swapped away for taste reasons.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['meal_name'],
    userScoped: true, creatable: true, deletable: true,
    fields: [id(), userRef(), text('meal_name'), ts('created_at', true)],
  },
  meal_suggestions: {
    table: 'meal_suggestions', label: 'Meal Suggestions', singular: 'Meal Suggestion', group: 'Nutrition Data',
    description: 'Generated meal suggestions / daily meal plans.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['meal_name', 'name', 'meal_type'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), date('date'), text('meal_type'), text('meal_name'), text('name', false),
      long('meal_description'), long('description', false), num('total_calories'), num('total_protein'),
      num('total_carbs'), num('total_fat'), text('difficulty', false), text('status'),
      bool('is_dismissed'), bool('flagged', false), text('dismiss_reason', false),
      num('prep_time_minutes', false), num('cook_time_minutes', false), long('suggestion_reason'),
      long('daily_coaching_note', false), long('tips', false), json('foods'), json('ingredients_json'),
      json('instructions'), json('instructions_json'), arr('warnings'), ts('created_at', true), ts('dismissed_at'),
    ],
  },
  meal_templates: {
    table: 'meal_templates', label: 'Meal Templates', singular: 'Meal Template', group: 'Nutrition Data',
    description: 'Saved user meal templates / meal-prep batches.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['name', 'meal_type'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), text('name'), text('meal_type'), bool('is_meal_prep'), num('total_calories'),
      num('total_protein'), num('total_carbs'), num('total_fat'), json('foods'), ts('created_at', true),
    ],
  },
  restaurant_cache: {
    table: 'restaurant_cache', label: 'Restaurant Cache', singular: 'Cached Restaurant', group: 'Nutrition Data',
    description: 'Cached restaurant menus (24h TTL in-app). Safe to clear.',
    primaryKey: 'id', defaultSort: { key: 'cached_at', dir: 'desc' }, searchFields: ['restaurant_name'],
    userScoped: false, creatable: false, deletable: true,
    fields: [id(), text('restaurant_name'), json('menu_json'), ts('cached_at', true)],
  },
  photo_meal_logs: {
    table: 'photo_meal_logs', label: 'Photo Meals', singular: 'Photo Meal', group: 'Nutrition Data',
    description: 'AI photo meal scans + leftover adjustments.',
    primaryKey: 'id', defaultSort: { key: 'analysed_at', dir: 'desc' }, searchFields: ['meal_name'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), ref('food_log_id', 'food_logs', ['food_name'], false), text('meal_name'),
      num('confidence'), text('image_url', false), text('leftover_image_url', false),
      num('total_calories'), num('total_protein_g'), num('total_carbs_g'), num('total_fat_g'),
      json('items'), long('notes'), long('adjustment_notes'), bool('is_adjusted'), ts('analysed_at', true),
    ],
  },
  nutrition_points_log: {
    table: 'nutrition_points_log', label: 'Nutrition Points', singular: 'Nutrition Points Row', group: 'Nutrition Data',
    description: 'Nutrition goal points awarded per day.',
    primaryKey: 'id', defaultSort: { key: 'date', dir: 'desc' }, searchFields: ['goal_hit'],
    userScoped: true, creatable: false, deletable: true,
    fields: [id(), userRef(), date('date'), num('points_awarded'), text('goal_hit')],
  },
  food_quality_logs: {
    table: 'food_quality_logs', label: 'Food Quality Logs', singular: 'Quality Log', group: 'Nutrition Data',
    description: 'Per-day whole-vs-processed quality scoring + Gardener summary.',
    primaryKey: 'id', defaultSort: { key: 'log_date', dir: 'desc' }, searchFields: [],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), date('log_date'), num('quality_score'), num('total_foods_logged'),
      num('whole_food_count'), num('processed_count'), num('high_additive_count', false),
      num('moderate_additive_count', false), num('low_additive_count', false), num('avg_completeness_score', false),
      json('top_additives'), long('gardener_summary'), ts('gardener_generated_at'), ts('created_at'),
    ],
  },
  user_ingredient_exposures: {
    table: 'user_ingredient_exposures', label: 'Ingredient Exposures', singular: 'Exposure', group: 'Nutrition Data',
    description: 'Per food-log additive/ingredient exposure rows.',
    primaryKey: 'id', defaultSort: { key: 'logged_at', dir: 'desc' }, searchFields: ['ingredient_name', 'e_number'],
    userScoped: true, creatable: false, deletable: true,
    fields: [
      id(), userRef(), ref('food_log_id', 'food_logs', ['food_name'], false), text('ingredient_name'),
      text('e_number'), text('category'), text('impact_level'), ts('logged_at', true),
    ],
  },
  ingredient_analyses: {
    table: 'ingredient_analyses', label: 'Ingredient Analyses', singular: 'Ingredient Analysis', group: 'Nutrition Data',
    description: 'Shared AI ingredient/additive analysis cache.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['ingredient_name', 'e_number', 'category'],
    userScoped: false, creatable: true, deletable: true,
    fields: [id(), text('ingredient_name'), text('e_number'), text('category'), json('analysis'), ts('created_at', true)],
  },

  // ===================================================================== Sleep
  sleep_logs: {
    table: 'sleep_logs', label: 'Sleep Logs', singular: 'Sleep Log', group: 'Sleep',
    description: 'Nightly sleep records.',
    primaryKey: 'id', defaultSort: { key: 'date', dir: 'desc' }, searchFields: ['notes'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), date('date'), time('bedtime'), time('wake_time'), num('duration_hours'),
      num('quality'), long('notes'), ts('logged_at'),
    ],
  },
  sleep_alarms: {
    table: 'sleep_alarms', label: 'Sleep Alarms', singular: 'Alarm', group: 'Sleep',
    description: 'User alarms + smart-wake settings.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['label'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), time('time'), text('label'), arr('days'), bool('is_active'),
      num('smart_wake_minutes'), ts('created_at', true),
    ],
  },
  sleep_notes: {
    table: 'sleep_notes', label: 'Sleep Notes', singular: 'Sleep Note', group: 'Sleep',
    description: 'Free-text sleep journal notes.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['note'],
    userScoped: true, creatable: true, deletable: true,
    fields: [id(), userRef(), date('date'), long('note', true), ts('created_at', true)],
  },

  // ================================================================ Goals data
  goal_progress_logs: {
    table: 'goal_progress_logs', label: 'Goal Progress', singular: 'Progress Log', group: 'Goals Data',
    description: 'Logged progress entries against goals.',
    primaryKey: 'id', defaultSort: { key: 'created_at', dir: 'desc' }, searchFields: ['note'],
    userScoped: true, creatable: true, deletable: true,
    fields: [
      id(), userRef(), ref('goal_id', 'goals', ['title']), num('value'), date('date'),
      long('note', true), ts('created_at', true),
    ],
  },
}

export function getResourceConfig(table: string): ResourceConfig | null {
  return RESOURCES[table] ?? null
}

export function resourcesByGroup(): { group: string; items: ResourceConfig[] }[] {
  return RESOURCE_GROUPS.map((group) => ({
    group,
    items: Object.values(RESOURCES).filter((r) => r.group === group),
  })).filter((g) => g.items.length > 0)
}
