# Roadmap: what's left to reach world-class standard

The app already has offline-first sync, saved views, anomaly alerts, follow-up outcome tracking with recovered revenue, AI insights + weekly digest, multi-language (EN/TA/HI), exports, backups and tenant RLS. Below is what is genuinely missing, in the order I'd build it.

## 1. WhatsApp inbound intake (highest value, already half-built)

The `wa_contacts` and `wa_sessions` tables exist, but no webhook function is deployed yet.

- Edge function `whatsapp-webhook`: Meta GET verify handshake, POST handling, signature validation, media download into the existing private buckets.
- Guided numbered replies: staff sends a message -> bot asks shop, then reason -> creates the visit entry and confirms back.
- Admin screen to approve staff phone numbers and view recent inbound messages.
- Needs from you: WhatsApp phone number ID, permanent access token, app secret, verify token.

## 2. Two-way follow-up outcomes

Today outcomes are recorded manually. With the webhook in place, an inbound reply from a customer's number auto-marks the matching follow-up as "replied" and surfaces the reply text in the timeline.

## 3. Customer intelligence

- Customer profile page: every visit and follow-up for one phone number, lifetime recovered value, tags (price-sensitive, size-gap, repeat visitor).
- Repeat-visitor detection at entry time: warn staff "this number visited 3 times, all lost on price".

## 4. Insight-to-action loop

- Weekly "top 3 fixes" card: which reason costs the most, which shop is worst, which staff needs coaching, each with a one-tap action.
- Stock/size gap report: recurring size or product misses aggregated for buying decisions.

## 5. Operational maturity

- In-app changelog and feature tour for new tenants.
- Health page for admins: sync queue, failed jobs, backup status, last digest sent (parts exist separately; unify them).
- Per-tenant usage metering and plan limits surfaced in the UI (limits exist in the DB but are only visible to Super Admin).

## 6. Trust and compliance (needed before larger clients)

- Data export / delete on request (GDPR-style) per tenant.
- Session device list with remote sign-out.
- Retention policy: auto-purge entries and media older than N months, configurable per tenant.

## Technical notes

- All new tables follow the existing pattern: `admin_id` column, explicit GRANTs, tenant-scoped RLS via `get_user_admin_id_secure`.
- The webhook is public by necessity, so it validates the Meta signature and only accepts numbers pre-approved in `wa_contacts`.
- Customer profile and repeat detection read from `follow_ups` plus the phone custom-field values already stored in `gd_entry_custom_values`.

## Suggested first slice

Item 1 (WhatsApp webhook + admin approval screen), since the schema is already there and it unlocks item 2.
