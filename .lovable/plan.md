# Stock Requirements (new home tab)

A second workflow alongside lost-sale visits: shop people raise a size/stock requirement, warehouse people pack and move it, the shop confirms receipt — with a full, separately reportable trail of who asked, who packed, who moved, and when.

## What the user gets

**New "Requirements" tab** on the home screen (desktop tabs + mobile bottom nav). "Log Visit" stays the default tab. Admins can hide the whole Requirements feature from the Admin panel, and Super Admin controls whether an account may use it at all.

**Raise a requirement** — shop staff, shop managers, admins and warehouse staff can create one. Form fields are admin-customisable in the same way as visit fields (size, category, quantity, urgency, note, plus any custom fields the admin defines). Quantity and urgency (Normal / Urgent) are built in.

**Work the queue (warehouse staff)** — a new "Warehouse staff" role, assignable to all shops or to several specific shops. They see every open requirement in their scope and can:
- Mark **Packed** (with optional packed quantity + note)
- Mark **Moved to shop** (with optional dispatch note)
- **Reject** with a reason
Shop side then marks **Received**. Every step records who did it and the exact time.

**Status flow:** Requested → Packed → Moved → Received, with Rejected possible from Requested or Packed.

**Filtering + search** — date range, shop, requester, size, status, urgency, warehouse handler, plus free-text search across all columns. Same collapsible filter pattern as the Reports page.

**Requirements report tab** — an isolated report view with its own tick-box row selection, column list (requested by / at, shop, size, qty, packed by / at, moved by / at, received by / at, turnaround time, status) and PDF + Excel + CSV export of exactly the selected or filtered rows, using the existing branded export template.

**Super Admin limits** — per account: feature on/off, monthly requirement limit, and max warehouse-staff users. Shown with the other limits in the Super Admin account dialog and enforced when raising a requirement or creating a warehouse user.

## Technical outline

**Database (one migration)**
- `stock_requirements` — admin_id, shop_id, requested_by, requested_by_name, size/category text + option ids, quantity, urgency, note, status, packed_by/packed_at/packed_qty, moved_by/moved_at, received_by/received_at, rejected_by/rejected_at/reject_reason, timestamps. GRANTs for authenticated + service_role; RLS scoped by `admin_id` with role rules (staff: own shop; manager: own shop; warehouse: assigned shops; admin: tenant).
- `stock_requirement_events` — append-only status log (requirement_id, from/to status, actor, actor_name, note, created_at) for the audit trail in reports.
- `profiles` additions: `warehouse_shop_ids uuid[]`, `requirements_enabled boolean`, `max_requirements_monthly int`, `max_warehouse_users int`.
- `profiles_role_check` extended with `warehouse`; `prevent_profile_privilege_escalation` extended to guard the new privileged columns.
- Security-definer helper `can_access_requirement(_shop_id uuid)` to avoid recursive RLS.
- Custom fields reuse: `custom_fields.scope` column (`visit` | `requirement`, default `visit`) and a `requirement_id` column on the values table, so the existing field-builder and validation trigger serve both forms.

**Frontend**
- `src/components/RequirementForm.tsx` — raise a requirement (reuses the custom-field renderer and shop pickers from the visit form).
- `src/components/RequirementsPanel.tsx` — queue/list with status actions, collapsible filters, search, bulk tick-box selection.
- `src/components/RequirementsReport.tsx` — report tab with columns, totals, turnaround, exports via `insightExports` helpers and `useExportTemplate`.
- `src/hooks/useRequirements.tsx` — fetch/mutate + realtime sync, tenant scoped.
- `MainApp.tsx` — new lazy tab, role-gated and hidden when the admin toggle or super-admin flag is off; `MobileBottomNav.tsx` updated.
- `src/components/admin/RequirementSettings.tsx` — admin toggle to show/hide the tab, plus field scope selector in `CustomFieldManagement`.
- `UserManagement.tsx` + `create-sub-user` / `update-sub-user` functions — allow `warehouse` role with multi-shop assignment and enforce the warehouse-user cap.
- `SuperAdminDashboard.tsx` — new limit inputs.

**Reuse:** export template/branding, saved-views filter bar pattern, offline outbox for raising requirements, realtime sync channel, existing PDF/Excel/CSV helpers.

## Notes

Requirements are fully tenant-isolated by `admin_id` like every other table. Existing visit data and reports are untouched.
