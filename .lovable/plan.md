# Four major features: WhatsApp intake, saved views, anomaly alerts, multi-language

This is a large scope. Below is the build order and what each piece does. I suggest shipping in this order so each part is usable on its own.

## 1. WhatsApp Cloud API intake (staff message -> visit entry)

Staff send a message to your WhatsApp business number; the app turns it into a non-purchase visit entry.

Flow:
```text
Staff WhatsApp msg -> Meta webhook -> edge function
   -> match phone to a staff profile
   -> ask "Which shop?" (numbered list)  -> reply 1/2/3
   -> ask "Reason?" (numbered list)      -> reply 1/2/3
   -> text becomes notes, image -> entry image, voice -> voice note
   -> create visit entry, confirm back on WhatsApp
```

Work:
- New table `wa_contacts` (phone -> profile/admin mapping, approved flag) and `wa_sessions` (in-progress conversation state, pending answers, expiry).
- Edge function `whatsapp-webhook`: GET verify handshake, POST message handling, signature validation with the Meta app secret, media download into the existing private buckets, guided numbered replies.
- Admin panel section: connect number, list/approve staff phone numbers, see recent inbound messages.
- Secrets needed from you: WhatsApp phone number ID, permanent access token, app secret, and a verify token.

Note: this requires an approved Meta WhatsApp Business number. Everything on our side works as soon as those credentials exist.

## 2. Role-aware saved report views

- New table `saved_views` (name, owner, admin_id, scope = private | shop | tenant, page = reports | dashboard, filters JSON).
- RLS: owner always sees own; shop scope visible to users of that shop; tenant scope visible to whole tenant; only Admin can create tenant scope.
- UI: "Save current view" + a views dropdown in Reports and Dashboard filter bars, with rename/delete and a "share" toggle. Default view can be pinned and auto-loads.

## 3. Anomaly alerts

- Detection compares each shop's visits (and per-reason counts) for the recent window against its own trailing baseline; flags a spike when it exceeds the baseline by a meaningful margin with enough volume to matter.
- Runs both client-side on dashboard data (instant) and via a scheduled edge function that writes rows to a new `anomaly_alerts` table so alerts persist and can be acknowledged.
- Surfaced in the existing notification bell with an unread badge; tapping opens a drill-down sheet showing the shop, reason, window, expected vs actual, and the matching entries.

## 4. Tamil + Hindi support

- Lightweight in-house i18n (no heavy dependency): `src/i18n/` with `en`, `ta`, `hi` dictionaries and a `useTranslation()` hook, wired through the existing `useFieldLabels` so admin-renamed field labels still win.
- Language picker in the header, persisted per user; number/date formatting follows the locale.
- Translated: navigation, dashboard cards and charts labels, reports table headers and filters, forms, validation messages, toasts, admin panel. Tenant-created data (shop names, custom field options) stays as entered.

## Technical notes

- All new tables get tenant-scoped RLS on `admin_id` plus explicit grants, consistent with the current schema.
- The WhatsApp webhook is public by necessity, so it validates the Meta signature and only accepts phone numbers pre-approved in `wa_contacts`.
- Saved views and alerts hydrate from the existing IndexedDB cache so they still work offline.

## Sequencing

I will build 4 (i18n) and 2 (saved views) first since they touch UI everywhere, then 3 (anomaly alerts), then 1 (WhatsApp) last because it is blocked on your Meta credentials.
