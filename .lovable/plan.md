# True offline-first app (WhatsApp/Telegram style) + business report

Scope note: this plan covers the offline rebuild as the code work, plus the business/pricing report delivered in chat. Anything beyond that is listed as a follow-up so the work fits the credit budget.

## What is broken today (verified)

- There are two different `useOfflineSync` implementations (`src/hooks/useOfflineSync.ts` and `.tsx`) using two different IndexedDB databases (`GDInsightsDB` vs `gd_offline_db`). Only the `.tsx` one is actually imported, so the queue in `src/lib/offlineStore.ts` / `src/lib/syncService.ts` is dead code.
- `src/lib/syncService.ts` uploads to buckets named `voice_notes` and `gd_images`, which do not exist. The real buckets are `gd-entry-images` and `gd-voice-notes`. Any sync attempt through that path would fail.
- Sync inserts omit `admin_id` and skip custom field values, so a synced entry would be missing tenant data.
- `public/sw.js` is a hand-written cache-first worker that can serve stale HTML and deleted chunks (already causing a "failed to load dynamically imported module" error in preview).

## 1. One offline engine

Delete the duplicate hook and the dead store, and rebuild a single offline layer:

- One IndexedDB database with stores for the outbox (pending entries), cached reference data (shops, categories, sizes, customer types, custom fields, profiles), and cached recent entries for Reports/Dashboard.
- Entries created offline get a local UUID and appear immediately in Reports and Dashboard with a "pending" clock badge, exactly like an unsent WhatsApp message.
- Images and voice notes are stored as blobs in IndexedDB, previewable while offline.

## 2. Reliable background sync

- Outbox processor with ordered delivery, exponential backoff, retry caps, and a permanent-failure state the user can retry or discard.
- Sync fires on reconnect, on app focus, on app start, and via Background Sync where the browser supports it.
- Uploads use the correct private buckets with the tenant-prefixed paths the RLS policies expect; inserts include `admin_id`, `shop_id`, `employee_id`, and all custom field values.
- Idempotency key per queued entry so a retry after a half-completed upload cannot create duplicates.

## 3. Read offline

- Reference lists and the most recent entries are cached on every successful online load and served from cache when offline, so Reports, Dashboard and the GD form stay usable with no network.
- Cached data is tenant-scoped and cleared on logout / tenant switch.

## 4. Offline UI

- Persistent connectivity strip: Offline / Syncing N / Synced, with a manual "Sync now" action.
- Per-row status on pending entries and a queue sheet listing pending, failing and failed items.
- Clear messaging that exports and AI insights require a connection.

## 5. Service worker replacement

Replace the hand-written `public/sw.js` with a generated worker (vite-plugin-pwa, `generateSW`) behind a guarded registration wrapper: never registers in Lovable preview/dev or in an iframe, NetworkFirst for HTML navigations, CacheFirst only for hashed assets, `/~oauth` excluded. This also removes the stale-chunk load error. Push notification handling currently in `sw.js` is preserved.

## 6. Business report (chat, no code)

- Feature gap audit: what exists vs what a market-leading version needs (Have / Missing / Nice-to-have) with a build order.
- Cost to build this app from scratch in INR: freelancer, boutique agency and mid-size agency ranges, module by module.
- Competitor positioning against comparable damage/inventory tracking SaaS.
- Recommended pricing in INR: one-time setup fee plus monthly tiers, with margin math and an enterprise option.

## Technical notes

- Files removed: `src/hooks/useOfflineSync.ts` (duplicate), `src/lib/offlineStore.ts`, `src/lib/syncService.ts`, `public/sw.js` (replaced).
- New: an offline database module, an outbox/sync module, and a guarded service-worker registration wrapper.
- Call sites updated: `DamagedGoodsForm`, `ReportsPanel`, `Dashboard`, `MainApp`.
- No database migrations and no RLS changes — offline writes reuse the existing insert paths.

## Follow-ups (not in this pass)

Offline edit/delete of already-synced entries, conflict resolution UI, and offline-capable exports.
