# World-class voice playback, Super Admin polish, and business report

## 1. Voice player — world-class playback and seek bar

Rework `VoiceNotePlayer` (used in Reports rows, Reports detail modal, and Dashboard) so playback feels like a premium messaging app:

- **True resume**: remember position per note so pause/play resumes exactly where stopped, including after switching rows, closing the detail modal, or navigating between Reports and Dashboard.
- **Precision seek bar**: pointer-events based drag (mouse, touch, pen) with hover scrub preview, a time tooltip that follows the cursor, click-anywhere-to-seek, and snap-free sub-second accuracy.
- **Smoother waveform**: real amplitude peaks decoded once per note (Web Audio) and cached, replacing the pseudo-random bars; played bars fill with a gradient sweep and a soft pulse at the playhead.
- **Buffered range** shown behind the played region so loading is visible on slow networks.
- **Controls**: skip back 5s / forward 5s buttons, speed cycling (0.5–2x), and an inline duration/remaining toggle.
- **Keyboard + accessibility** kept and extended: space, arrows, Home/End, digits, plus proper `aria-valuetext` with time.
- **One-at-a-time playback** preserved; pausing another player retains its resume position.
- Compact (table row) and full (modal/dashboard) layouts both updated.

## 2. Super Admin page — UX/UI format

Restructure `SuperAdminDashboard` for clarity:

- Sticky page header with title, environment badge, and a global refresh.
- KPI strip at the top: total tenants, active vs paused, total users, entries this month, AI calls today, last backup status.
- Tabs reorganized into: Overview, Tenants, AI & Limits, Backups, Settings, Audit, Health — with consistent card headers, spacing, and empty states.
- Tenants table gets search, status filter, sortable columns, and row actions grouped in a menu instead of inline button clutter.
- Mobile: tabs become a scrollable pill row; tables collapse to cards.
- Reuse existing premium-card styling, tokens, and skeleton loaders (no new color values).

## 3. Feature gap review (delivered in chat, not code)

An A-to-Z audit of what exists vs what a world-class version needs, grouped by: data & reporting, collaboration, automation, mobile, security/compliance, and monetization — each item marked as Have / Missing / Nice-to-have, with a recommended build order.

## 4. Business report (delivered in chat)

- Cost to build this app from scratch in INR (freelancer, boutique agency, and mid-size agency ranges, with a module-by-module breakdown of the current scope).
- Recommended per-client pricing in INR: setup fee plus monthly tiers, with margin math and an enterprise option.
- Free-tier capacity analysis: how many tenants and users realistically fit inside Supabase free limits (database size, storage, egress, monthly active users, edge function invocations, cron) and Vercel free limits (bandwidth, build minutes, function usage), where the first bottleneck hits, and what the upgrade path costs.

## Technical notes

- Voice work is confined to `src/components/VoiceNotePlayer.tsx` plus a small shared playback-position store; Reports and Dashboard call sites stay unchanged.
- Waveform peak extraction runs once per signed URL and is cached in memory (and sessionStorage) to avoid re-decoding on every render.
- Super Admin changes are presentation-only: no RLS, query, or edge function changes.
- No database migrations in this plan.
