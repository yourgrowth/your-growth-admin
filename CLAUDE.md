@AGENTS.md

# Food Database section (added 2026-06-15)

Admin control centre for the Australian scraped food database
(Woolworths + Coles + Open Food Facts + Ollama vision pipeline).

- **Route:** `/food-database` (sidebar → Content → "Food Database", `database` icon)
- **Files:**
  - `app/(admin)/food-database/page.tsx` — server data fetch (overview stats, scraper runs, brands, first products page)
  - `app/(admin)/food-database/FoodDatabaseClient.tsx` — 5-tab shell (Overview | Products | Quality | Enrichment | Settings); active tab + all Products filters/sort/pagination persist in URL query params
  - `app/(admin)/food-database/_ui.tsx` — shared UI primitives (Card, Modal, Button, Input, Select, Pill, Toaster, Skeleton, source colours/labels, relative time) matching the admin design system
  - `app/(admin)/food-database/tabs/{Overview,Products,Quality,Enrichment,Settings}Tab.tsx`
  - `app/actions/foodDatabase.ts` — all reads + mutations (service-role, `requireAdmin()` guard, `admin_audit_log` entries)
  - `app/api/food-export/route.ts` — CSV export honouring current filters or an explicit `ids` selection
  - `lib/foodFilters.ts` — shared filter builder + URL param parsing + coverage helper (used by action + export route)
  - Types `Food` and `ScraperRun` added to `types/database.ts` (both exported + registered in the `Database` Tables map)

- **Tabs:**
  - **Overview** — stat cards (auto-refresh, interval from localStorage), source breakdown, Supabase **Realtime live feed** (`foods-realtime` channel, INSERT/UPDATE, pause/resume + buffered counter, LIVE/IDLE pill), scraper run history + "Log New Run" form
  - **Products** — search (debounced), source multi-select, brand/status filters, missing-macros / missing-image toggles, date range, page size, collapsible nutrient-range filters, sortable columns, row checkboxes + bulk bar (delete/publish/unpublish/flag/export), inline publish toggle + flag icon, Cover% indicator, row ⋮ menu (View Raw, Re-enrich=copy barcode, Flag, Copy barcode, Open in OFF), show/hide columns (localStorage), Add/Edit modal (validation + unusual-value warnings + image preview), delete confirm, Raw JSON viewer, CSV export, CSV import (preview + upsert-by-barcode + summary)
  - **Quality** — coverage heatmap, duplicate detector (keep-one or merge-best-values resolve modal), outlier detection (+ flag all), missing-data breakdown bar chart, app search preview
  - **Enrichment** — status cards, generators for OFF / Ollama re-enrichment scripts (copy-paste, run locally), cache management for `nutrition_cache` + `product_analyses` (clear by barcode / clear all)
  - **Settings** — publish/unpublish all, default visible columns, auto-refresh interval, Danger Zone (clear scraper logs; delete ALL foods behind a "type DELETE" lock)

## Supabase changes — run `supabase/migrations/20260615000001_food_database_admin.sql` first

- `foods`: added `is_published boolean default true`, `flagged_for_review boolean default false`, `flag_reason text`; added FTS GIN index + source/created_at/published/flagged indexes
- New table `scraper_runs` (run log)
- Enabled RLS on `foods` + `scraper_runs` with admin-only SELECT policies (writes go through the service-role key)
- Added `foods` to the `supabase_realtime` publication (required for the Overview live feed)

No new environment variables — uses the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

# Data Control framework + Mastering Yourself (added 2026-06-27)

Brought the admin in line with the bonsai-app schema (Sessions 49–60). ~26 newer
tables had zero admin presence; this adds full, audited, edit-everything control
plus a bespoke Mastering Yourself section. No DB migrations — all tables already
exist. No new env vars.

## Generic, config-driven CRUD framework

The force-multiplier: any table listed in `lib/admin/resources.ts` gets a complete
admin grid at `/data/<table>` with **zero bespoke code**.

- **`lib/supabase/generic.ts`** — `genericAdmin()`: service-role client WITHOUT the
  `Database` generic, so the framework can address arbitrary tables by name
  (the typed `createAdminClient()` only knows tables in `types/database.ts`).
  Server-only — never import from a client component.
- **`app/actions/_admin.ts`** — shared `requireAdmin()` + `audit()` (mirrors the
  inline helpers in `foodDatabase.ts`). Every new action file uses these.
- **`lib/admin/resources.ts`** — pure-data registry (`RESOURCES`). Per table:
  label/group/description, `primaryKey`, `defaultSort`, `searchFields`, `userScoped`,
  `creatable`/`deletable`, and a `fields[]` schema (key, label, `type`, `editable`,
  `inTable`, `options` for selects, `ref` for FK label resolution). `type` drives both
  the editor control and value coercion. Importable by server **and** client (no funcs
  with side effects). Groups: Mastery, Gardener Intelligence, Nutrition Data, Sleep,
  Goals Data.
- **`app/actions/resources.ts`** — generic `listResource` (search across `searchFields`,
  per-user filter, sort, pagination, batched FK-label resolution), `upsertResource`
  (type-coerced create/update, whitelisted by config, JSON parsed server-side),
  `deleteResource`, `bulkDeleteResource`, `searchProfiles` (user picker),
  `getResourceCounts` (hub tiles). All `requireAdmin()` + `audit()` to `admin_audit_log`.
- **`components/admin/kit.tsx`** — shared design-system primitives (same tokens as
  Food Database `_ui.tsx`): Card, Button, Input, Textarea, Select, Field, Modal,
  ConfirmDialog, Tabs, Pill, Skeleton, EmptyState, ToastProvider/useToast, relativeTime.
- **`components/admin/ResourceManager.tsx`** — the generic grid client: debounced search,
  sortable columns, pagination, per-user filter (profile search combo), row checkboxes +
  bulk delete, add/edit modal auto-built from the field schema (booleans, selects,
  **raw-JSON/array editors**, long-text, date/time, and a profile picker for `user_id`
  refs), per-row raw-JSON viewer, delete confirmations, CSV export.

## Routes

- **`/data`** — Data Control hub: every resource grouped, with live row counts.
- **`/data/[resource]`** — full CRUD grid for any configured table (`notFound()` otherwise).
- **`/mastery`** — bespoke Mastering Yourself section (see below).

## Mastering Yourself (`/mastery`)

Full **content CMS + per-user viewer** for the Session-59 mastery system.

- **`app/actions/mastery.ts`** — `getMasteryStats`, `listMasteryUsers`,
  `getUserMastery(userId)` (topics/tasks/sessions/insights + pillar-name map),
  `getSessionMessages(sessionId)`.
- **`app/(admin)/mastery/{page,MasteryClient}.tsx`** — tabs:
  - **Overview** — stat cards (pillars/users/topics/sessions/messages/insights/tasks)
  - **Pillars (CMS)** — embeds `ResourceManager` for `mastery_pillars`; founder edits
    name/slug/essence/accent/sort_order + `probing_questions` & `opening_angle_bank` JSON
  - **Explore by user** — searchable user list → per-user topics, sessions
    (tap → full chat transcript modal with crisis flags), insights, tasks
  - **Raw tables** — links into the `/data/mastery_*` grids

## Sidebar

New **Data & Intelligence** group: Mastering Yourself (`/mastery`), Data Control
(`/data`), Intelligence Models (`/data/user_models`).

## Coverage added (all editable + audited)

Mastery (pillars/topics/tasks/sessions/messages/insights/daily_dump);
Gardener Intelligence (user_models, gardener_profiles, context_snapshots,
engagement_log, tone_signals, insights_metadata, strategy_decisions, pipeline_runs);
Nutrition Data (meal_preps, meal_prep_items, user_taste_profile, disliked_meals,
meal_suggestions, meal_templates, restaurant_cache, photo_meal_logs,
nutrition_points_log, food_quality_logs, user_ingredient_exposures, ingredient_analyses);
Sleep (sleep_logs, sleep_alarms, sleep_notes); Goals Data (goal_progress_logs).

To surface a new table later: add one entry to `RESOURCES` — the grid, hub tile,
routing, and audit logging all come for free.

Verified with `npx tsc --noEmit` (clean) and `npm run build` (all three new routes
compile as dynamic).
