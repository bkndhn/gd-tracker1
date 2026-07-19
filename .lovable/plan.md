# Plan

Big scope — split into 4 phases so each ships verifiable value. Phase 1 is safe UX + AI controls; Phase 2 is the risky "remove standard fields" migration.

## Phase 1 — Custom field UX + radio + reordering (safe, no data migration)

**Schema (migration)**
- `custom_fields`: add `display_order INT`, `is_standard BOOLEAN DEFAULT false`, `standard_key TEXT` (values: `shop|category|size|customer_type`). Backfill 4 rows per admin representing the current standard fields so they show up in the same reorder list.
- `custom_fields.field_type` CHECK: add `'radio'`.
- Tenant/branch isolation re-verified via existing `admin_id` scoping; add `admin_id` NOT NULL enforcement + policy tightening on `custom_fields` and `custom_field_options`.

**Admin panel (`CustomFieldManagement.tsx`)**
- Single unified list showing standard + custom fields together.
- Drag-to-reorder (dnd-kit) writing `display_order`.
- Field-type picker gains **Radio**; standard fields keep their fixed type (Phase 2 removes this restriction).
- Per-admin isolation preserved (already scoped by `admin_id`).

**GD form (`DamagedGoodsForm.tsx`)**
- Render fields sorted by `display_order`, mixing standard + custom freely.
- Add `RadioGroup` renderer for `field_type='radio'`.

**Reports / Dashboard / Drive backup**
- Read the same ordered list so column order matches admin config.

## Phase 2 — Full replacement of standard fields (planned, not auto-shipped)

Marked as a follow-up because it is destructive and touches ~20 files. Deliverable in this phase: a written migration plan doc (`docs/CUSTOM_FIELDS_MIGRATION.md`) covering:
- Copy every `shops/categories/sizes/customer_types` row into `custom_field_options` under the 4 seeded standard `custom_fields`.
- Rewrite `goods_damaged_entries` foreign keys into `gd_entry_custom_values` rows.
- Update Reports/Dashboard/AI/Drive exports to read only from custom values.
- Rollback SQL + dry-run script.

I will ship the doc + seed migration this turn. Actual cutover runs only after you approve the doc (one-way change).

## Phase 3 — Super Admin AI quotas

**Schema**
- `profiles`: add `ai_daily_limit INT`, `ai_monthly_limit INT`, `ai_lifetime_limit INT` (NULL = unlimited). Keep existing `ai_enabled` toggle.
- New table `ai_usage_log(admin_id, user_id, created_at)` with indexes on `(admin_id, created_at)`.
- Grants + RLS: only super_admin reads all; admin reads own tenant aggregate.

**Edge function `gd-ai-insights`**
- Before calling model: count today / this month / lifetime for the caller's `admin_id`; reject with `429` + clear message if exceeded.
- Insert usage row after successful call.

**Super Admin UI (`SuperAdminDashboard.tsx`)**
- Per-admin row: AI enabled toggle + 3 numeric inputs (day/month/lifetime) + live usage counters.

**Gemini free tier note** (answering your question): Lovable AI Gateway does not expose per-user Gemini quotas — usage is billed from your workspace credit pool (Google/Gemini itself doesn't grant end-user quotas via the gateway). So limits must be enforced by us in the edge function, which is what this phase does.

## Phase 4 — Security & launch readiness review

After Phase 1 + 3 ship:
- Run `security--run_security_scan`, fix findings, mark resolved.
- Produce `LAUNCH_READINESS.md`: RLS coverage matrix, tenant isolation proof, auth hardening checklist, backup/PITR status, known gaps.

## Out of scope this turn
- Actual data cutover from standard → custom (Phase 2 cutover) — needs your go-ahead on the doc.
- hCaptcha, PITR (previously declined).

## Technical notes
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` (already common in shadcn ecosystems; ~15KB).
- All new tables get GRANTs for `authenticated` + `service_role`, RLS enabled, `admin_id`-scoped policies using existing `get_user_admin_id_secure`.
- Realtime channels stay tenant-scoped (`tenant:<admin_id>`).

Confirm and I'll execute Phase 1 + 3 + the Phase 2 planning doc in one go, then Phase 4.