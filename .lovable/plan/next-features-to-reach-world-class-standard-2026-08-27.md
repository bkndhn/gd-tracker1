# Next features to reach world-class standard

Already built and verified: WhatsApp inbound intake with guided replies, two-way follow-up auto-marking, customer profile timeline, repeat-visitor hint, top-3-fixes card, stock/size gap report, anomaly alerts, saved views, multi-language, recovery attribution with drill-downs, audit log with diff + rollback, offline-first sync, scheduled digests, export templates, evidence uploads.

What remains, in priority order:

## 1. Data retention & privacy (needed before larger clients)
- Per-tenant retention policy: auto-purge entries, media (images/voice/evidence) and audit logs older than N months. Admin chooses N in settings; a scheduled edge function purges and writes a summary row.
- GDPR-style data export/delete per customer phone number: one-click export of all visits/follow-ups/messages for a number (PDF/JSON), and anonymize-on-request.

## 2. Session & device management
- `user_sessions` table recording device, browser, IP, last-active per login.
- Profile/Admin screen: list active sessions, remote sign-out of any device, force-logout-all button.
- Audit-log entry for each remote sign-out.

## 3. Per-tenant usage metering in the Admin UI
- Usage card visible to each Admin (not just Super Admin): entries this month, storage used, AI quota used/consumed vs plan limits (limits already exist in DB).
- Warning banners at 80% and hard-block messaging at 100%, with upgrade contact CTA.

## 4. In-app changelog & feature tour
- `changelog` table + "What's new" bell badge showing entries since last seen.
- First-login feature tour (dismissible, re-runnable from settings) for new tenant users.

## 5. Operational health unification
- Single Admin "Health" page combining: sync queue status, failed export jobs, last digest sent, last GDrive backup, webhook errors (components exist separately; unify into one screen).

## Suggested first slice
Item 1 (retention + customer data export/delete), since it is the main blocker for larger/regulated clients, followed by item 2.

## Technical notes
- All new tables follow the existing pattern: `admin_id` column, explicit GRANTs, tenant-scoped RLS via `get_user_admin_id_secure`, `deleted_at` soft-delete where relevant.
- Retention purge runs as a `pg_cron`-scheduled edge function using the service role; it removes storage objects before DB rows and logs to `audit_logs`.
- Session tracking hooks into the existing auth flow in `useAuth.tsx`; remote sign-out uses Supabase admin `signOut(userId)` from an edge function.
- Usage metering reads from existing limit tables plus a `count(*)`/storage-size query; no schema change needed beyond a small view.
