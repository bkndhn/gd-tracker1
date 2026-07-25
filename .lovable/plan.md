
# Full custom-field cutover + validation + export preview

This is a large, staged change touching the two biggest screens in the app, the GD form, one edge function, and adds two new pieces. Because it's destructive to the legacy read/write paths, I want approval on scope and ordering before I ship it.

## 1. Dashboard + Reports read from `gd_entry_custom_values`

Today both screens join `shops`, `categories`, `sizes`, `customer_types` and drive filters/summary cards from those FKs. Cutover:

- New shared hook `useEntryCustomValues(entryIds)` — one batched fetch of `gd_entry_custom_values` + `custom_field_options` + `custom_fields` for a set of entry IDs, returned as `{ [entryId]: { [fieldId]: { value, fieldName, standardKey } } }`.
- Dashboard: replace the `shops:shop_id(name) …` joins with a plain entry fetch + the hook. Summary breakdowns (byShop, byCategory, bySize, byCustomerType) key on the seeded standard fields via `standard_key`. Filter dropdowns fed by `custom_field_options` scoped to those seeded fields (per tenant). Modal drill-down + PDF/Excel export from Dashboard read the same shape.
- Reports: same swap. Table column filters, sorting, global search, and summary cards all key off custom-field values. Extra visible custom fields already render as extra columns — this unifies them with the four ex-standard ones so there's a single code path.
- Field labels keep flowing through `useFieldLabels` (already sourced from `custom_fields.name`).

## 2. Remove legacy dual-write and legacy dependencies

Only after step 1 is verified in the preview:

- `DamagedGoodsForm.tsx`: drop the `standardFieldMap` bridge — stop writing `shop_id`/`category_id`/`size_id`/`customer_type_id` on `goods_damaged_entries`. Keep writing `shop_id` for now because RLS and manager isolation depend on `profiles.shop_id` matching an entry's `shop_id`; that stays until we redesign RLS. Category/size/customer_type FKs stop being written.
- Migration: make `category_id`, `size_id`, `customer_type_id` nullable if not already, and archive `categories`, `sizes`, `customer_types` by renaming to `_legacy_*` with grants revoked (kept 30 days for rollback per the migration doc). Do **not** drop.
- Delete legacy admin UI already gone; also delete unused imports/types referencing those tables in `Dashboard.tsx`, `ReportsPanel.tsx`, `AnalyticsCharts.tsx`, `AIInsightsPanel.tsx`, `src/types/database.ts`, edge functions `backup-to-gdrive`, `send-scheduled-reports`, `export-excel-with-images`, `gd-ai-insights`.
- Edge functions rewritten to read from `gd_entry_custom_values` for the four ex-standard fields plus any admin-added custom fields (they already partially do).

Risk: `shop_id` stays on the entry row. Everything else routes through custom values.

## 3. Server-side custom-field validation

New Postgres trigger `validate_gd_entry_custom_values()` on `gd_entry_custom_values` INSERT/UPDATE and a companion trigger on `goods_damaged_entries` AFTER INSERT that verifies:

- Every `custom_fields` row with `is_mandatory = true` and `is_visible = true` for the entry's admin has a matching value.
- For `dropdown`/`radio`: `custom_field_option_id` must reference an option belonging to that field.
- For `text`: `value` non-empty, length ≤ 500.
- For `number`: `value` matches `^-?\d+(\.\d+)?$`.
- For `date`: `value` matches `^\d{4}-\d{2}-\d{2}$` and parses.

Raises `EXCEPTION` with a clear message so the form's `onError` surfaces which field failed. Client-side validation in `DamagedGoodsForm` is kept as a UX layer; the trigger is the source of truth.

## 4. Export preview

New component `ExportPreviewDialog.tsx` opened from `ExportSettings.tsx` ("Preview PDF" / "Preview Excel" buttons):

- Fetches the last 5 real GD entries for the admin using the same custom-value pipeline as the exporter.
- Renders an in-modal HTML table that mirrors the exact column order and formatting the real export will produce (same header styling, same date format, same image-thumb placement for PDF).
- Excel preview uses a scrollable HTML grid mirroring the sheet; PDF preview reuses the print-CSS the real export uses so what you see = what prints.
- Live-updates as the admin toggles/reorders fields in the settings panel — no save required to preview.

## Files touched

Frontend (edit): `src/components/Dashboard.tsx`, `src/components/ReportsPanel.tsx`, `src/components/DamagedGoodsForm.tsx`, `src/components/AnalyticsCharts.tsx`, `src/components/AIInsightsPanel.tsx`, `src/components/admin/ExportSettings.tsx`, `src/types/database.ts`.
Frontend (new): `src/hooks/useEntryCustomValues.tsx`, `src/components/admin/ExportPreviewDialog.tsx`.
Edge functions (edit): `supabase/functions/gd-ai-insights/index.ts`, `supabase/functions/backup-to-gdrive/index.ts`, `supabase/functions/send-scheduled-reports/index.ts`, `supabase/functions/export-excel-with-images/index.ts`.
DB migrations: (a) validation trigger; (b) archive legacy lookup tables + null legacy FKs on entries.

## Order of shipping

I'll ship these in **four separate migrations / commits** so each stage is reversible:

1. Read cutover (frontend only, dual-write still on).
2. Validation trigger migration.
3. Export preview.
4. Stop dual-write + archive legacy tables (destructive; last).

## Explicit call-outs / risks

- Manager RLS still uses `profiles.shop_id` = `goods_damaged_entries.shop_id`. `shop_id` on entries **stays**. Renaming the "Shop" custom field in the UI won't move data isolation — that's still branch-based, correctly.
- Historical entries without `gd_entry_custom_values` were backfilled in the last migration, so cutover reads should be complete. I'll add a defensive fallback that reads legacy columns only if a custom value is missing, then log to detect any gaps.
- The archive step (step 4) is 30-day reversible via the `_legacy_*` tables per your migration doc. After 30 days you'd need a manual drop.

Approve and I'll ship stage 1 first, verify Dashboard/Reports visually against real data, then proceed through stages 2–4 in this same run.
