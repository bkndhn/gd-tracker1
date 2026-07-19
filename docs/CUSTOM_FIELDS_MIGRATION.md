# Migration plan: replace standard fields with custom fields only

Status: **DRAFT — do not execute without explicit approval.** This is a one-way, destructive change to the data model.

## Goal
Remove the four hard-coded lookup tables (`shops`, `categories`, `sizes`, `customer_types`) as concepts on `goods_damaged_entries` and represent them purely as `custom_fields` rows so admins can rename, reorder, hide, or change their input type freely (dropdown, radio, text, number, date, etc.).

`shops` cannot be removed from the schema — it's referenced by `profiles.shop_id` and used for RLS/branch isolation. It stays as a physical branch entity but is no longer a required column on entries; instead it lives as a system-managed custom field.

## Phase 2A — Seed (safe, reversible)
1. For every admin, create 4 `custom_fields` rows with `is_standard=true` and `standard_key ∈ {shop, category, size, customer_type}`.
2. Copy every row from the four lookup tables into `custom_field_options` under the matching seeded field, storing the original UUID in a new `legacy_id UUID` column for reverse lookup.
3. Keep the old columns on `goods_damaged_entries` intact. Nothing breaks.

## Phase 2B — Dual-write (compat window)
1. In `DamagedGoodsForm`, when the user picks an option under a `is_standard` field, write **both** the legacy FK column (`shop_id`, `category_id`, …) and the `gd_entry_custom_values` row.
2. Reports/Dashboard/AI/Drive backup keep reading from the legacy columns.
3. This proves the seeded custom fields are complete and correct in production before any cutover.

## Phase 2C — Read cutover
1. Switch Reports, Dashboard, AI Insights prompt builder, Google Drive backup, and WhatsApp share to read the shop/category/size/customer_type values from `gd_entry_custom_values` via the seeded fields.
2. Update column headers, filters, and grouping to use `custom_fields.name` (already admin-renamable via display order).
3. Keep dual-write on — legacy columns still populated.

## Phase 2D — Stop writing legacy columns
1. Remove legacy FK writes from `DamagedGoodsForm`.
2. Backfill any missing `gd_entry_custom_values` for older rows using the legacy FKs.
3. Make legacy columns nullable (they already are for most).

## Phase 2E — Retire legacy tables
1. Drop `category_id`, `size_id`, `customer_type_id` FKs on `goods_damaged_entries`.
2. Soft-archive `categories`, `sizes`, `customer_types` (rename to `_legacy_*`, revoke grants) — do NOT drop for 30 days so a rollback is possible.
3. Move `shops` admin UI to point at the seeded `standard_key='shop'` custom field. The `shops` table stays because RLS uses `profiles.shop_id`.

## Rollback
Any phase before 2E is reversible by re-enabling legacy writes and switching reads back. After 2E, restore requires the archived `_legacy_*` tables and the `legacy_id` column on `custom_field_options`.

## Files touched
- `DamagedGoodsForm.tsx` — dynamic renderer already supports mixed types; just needs to include seeded standard fields.
- `Dashboard.tsx`, `ReportsPanel.tsx`, `AnalyticsCharts.tsx` — swap `shops:shop_id(name)` joins for `gd_entry_custom_values` reads keyed by `standard_key`.
- `supabase/functions/gd-ai-insights/index.ts` — data payload builder.
- `supabase/functions/backup-to-gdrive/index.ts`, `send-scheduled-reports/index.ts`, `export-excel-with-images/index.ts` — export column mapping.
- `admin/CategoryManagement.tsx`, `SizeManagement.tsx`, `CustomerTypeManagement.tsx`, `ShopManagement.tsx` — either delete (they become custom-field options) or turn into thin wrappers that redirect to CustomFieldManagement.

## Risks
- Historical entries created before 2B will have no `gd_entry_custom_values` rows unless backfilled in 2D. Skipping the backfill silently blanks columns in reports.
- Any external integration (Google Drive backup XLSX consumers, scheduled email report subscribers) will see renamed/re-typed columns after 2C.
- `shop_id` cannot be removed — it stays on `profiles` and on entries for RLS.

## Decision to make now
Do you want to run **Phase 2A + 2B** (safe, reversible, no user-visible change) so you can validate the seeded data, then approve 2C–2E later? That's my recommendation. Say the word and I'll ship 2A + 2B.
