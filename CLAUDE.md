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
