/**
 * Lightweight, self-hosted error tracking + release health.
 *
 * Mirrors the parts of Sentry that matter for this app without shipping an
 * external SDK or leaking tenant data to a third party:
 *  - global exception / unhandled rejection capture
 *  - React error-boundary crash capture
 *  - breadcrumbs for the last user actions before the failure
 *  - fingerprint-based grouping + client-side dedupe & rate limiting
 *  - session tracking so "crash-free sessions" can be computed per release
 */
import { supabase } from '@/integrations/supabase/client';

export const APP_RELEASE = '1.4.0';
export const APP_ENVIRONMENT = import.meta.env.DEV ? 'development' : 'production';

const SESSION_KEY = 'gd_tracking_session_id';
const MAX_EVENTS_PER_SESSION = 25;
const DEDUPE_WINDOW_MS = 60_000;
const HEARTBEAT_MS = 60_000;
const MAX_BREADCRUMBS = 15;

type Level = 'error' | 'warn' | 'fatal';

interface Breadcrumb {
  ts: number;
  category: string;
  message: string;
}

interface CaptureOptions {
  level?: Level;
  kind?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
}

const state = {
  installed: false,
  userId: null as string | null,
  adminId: null as string | null,
  sessionId: '',
  sessionRowCreated: false,
  sessionErrored: false,
  sessionCrashed: false,
  sessionStart: Date.now(),
  eventCount: 0,
  lastSeen: new Map<string, number>(),
  breadcrumbs: [] as Breadcrumb[],
  heartbeat: undefined as ReturnType<typeof setInterval> | undefined,
};

function getSessionId(): string {
  if (state.sessionId) return state.sessionId;
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      state.sessionId = existing;
      return existing;
    }
  } catch {
    /* storage unavailable */
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  state.sessionId = id;
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/** Stable-ish group key: message shape + top frame, with volatile bits stripped */
function fingerprint(message: string, stack?: string): string {
  const normalizedMessage = message
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\d+/g, '<n>')
    .slice(0, 180);

  const topFrame = (stack || '')
    .split('\n')
    .map(l => l.trim())
    .find(l => l.startsWith('at ') || l.includes('@'))
    ?.replace(/:\d+:\d+/g, '')
    .replace(/\?[^)\s]*/g, '')
    .slice(0, 120) || '';

  return `${normalizedMessage}::${topFrame}`;
}

export function addBreadcrumb(category: string, message: string) {
  state.breadcrumbs.push({ ts: Date.now(), category, message: String(message).slice(0, 200) });
  if (state.breadcrumbs.length > MAX_BREADCRUMBS) state.breadcrumbs.shift();
}

async function markSession(changes: { errored?: boolean; crashed?: boolean }) {
  if (changes.errored) state.sessionErrored = true;
  if (changes.crashed) state.sessionCrashed = true;
  if (!state.sessionRowCreated) return;
  try {
    await (supabase.from('app_sessions') as any)
      .update({
        errored: state.sessionErrored,
        crashed: state.sessionCrashed,
        last_seen_at: new Date().toISOString(),
        duration_ms: Date.now() - state.sessionStart,
      })
      .eq('session_id', getSessionId());
  } catch {
    /* never let telemetry break the app */
  }
}

/** Records an exception. Always resolves — telemetry must never throw. */
export async function captureException(error: unknown, options: CaptureOptions = {}) {
  try {
    const level: Level = options.level || 'error';
    const err = error instanceof Error ? error : undefined;
    const rawMessage = err?.message || (typeof error === 'string' ? error : JSON.stringify(error ?? 'Unknown error'));
    const message = String(rawMessage).slice(0, 2000);
    const stack = err?.stack?.slice(0, 8000);
    const fp = fingerprint(message, stack);

    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn('[tracking]', level, message, options.extra || '');
    }

    // Rate limit + dedupe so a render loop can't hammer the database
    const now = Date.now();
    const last = state.lastSeen.get(fp);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    state.lastSeen.set(fp, now);
    if (state.eventCount >= MAX_EVENTS_PER_SESSION) return;
    state.eventCount += 1;

    void markSession({ errored: true, crashed: level === 'fatal' });

    await (supabase.from('client_errors') as any).insert({
      user_id: state.userId,
      admin_id: state.adminId,
      release: APP_RELEASE,
      environment: APP_ENVIRONMENT,
      level,
      kind: options.kind || 'exception',
      message,
      stack,
      component_stack: options.componentStack?.slice(0, 8000) || null,
      url: (typeof location !== 'undefined' ? location.href : '').slice(0, 1000),
      user_agent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 500),
      session_id: getSessionId(),
      fingerprint: fp,
      breadcrumbs: state.breadcrumbs.slice(-MAX_BREADCRUMBS),
    });
  } catch {
    /* swallow */
  }
}

export function captureMessage(message: string, level: Level = 'warn') {
  return captureException(message, { level, kind: 'message' });
}

/**
 * Associates the current session with a signed-in user and opens the session
 * row used for release health. Called once auth resolves.
 */
export async function identifySession(userId: string | null, adminId: string | null) {
  state.userId = userId;
  state.adminId = adminId;
  if (!userId || state.sessionRowCreated) return;

  try {
    const { error } = await (supabase.from('app_sessions') as any).upsert(
      {
        session_id: getSessionId(),
        user_id: userId,
        admin_id: adminId,
        release: APP_RELEASE,
        environment: APP_ENVIRONMENT,
        user_agent: navigator.userAgent.slice(0, 500),
        errored: state.sessionErrored,
        crashed: state.sessionCrashed,
        started_at: new Date(state.sessionStart).toISOString(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' },
    );
    if (!error) state.sessionRowCreated = true;
  } catch {
    /* ignore */
  }
}

export function clearSessionUser() {
  state.userId = null;
  state.adminId = null;
}

/** Installs the global handlers. Safe to call more than once. */
export function initErrorTracking() {
  if (state.installed || typeof window === 'undefined') return;
  state.installed = true;
  state.sessionStart = Date.now();
  getSessionId();

  window.addEventListener('error', event => {
    if (event.error) {
      void captureException(event.error, { kind: 'window.onerror' });
    } else if (event.message) {
      void captureException(event.message, { kind: 'window.onerror' });
    }
  });

  window.addEventListener('unhandledrejection', event => {
    void captureException(event.reason, { kind: 'unhandledrejection' });
  });

  // Cheap navigation/interaction breadcrumbs
  window.addEventListener('click', e => {
    const target = e.target as HTMLElement | null;
    const label = target?.closest('button,a,[role="tab"]')?.textContent?.trim();
    if (label) addBreadcrumb('ui.click', label.slice(0, 60));
  }, { capture: true, passive: true });

  document.addEventListener('visibilitychange', () => {
    addBreadcrumb('app', document.hidden ? 'backgrounded' : 'foregrounded');
    if (document.hidden) void markSession({});
  });

  state.heartbeat = setInterval(() => void markSession({}), HEARTBEAT_MS);

  window.addEventListener('pagehide', () => {
    if (state.heartbeat) clearInterval(state.heartbeat);
    void markSession({});
  });
}
