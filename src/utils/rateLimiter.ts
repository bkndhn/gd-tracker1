/**
 * Persistent Client-Side Rate Limiter
 *
 * Protects authentication endpoints (sign in, sign up, password reset) and sensitive
 * client actions from brute-force attempts and credential stuffing.
 * State is stored in localStorage so reloading or re-rendering the page cannot bypass lockouts.
 */

export type RateLimitAction =
  | 'auth:signin'
  | 'auth:signup'
  | 'auth:forgot-password'
  | 'auth:reset-password'
  | 'action:create-shop'
  | 'action:custom-field';

interface RateLimitRule {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
  progressive?: boolean;
}

interface StoredEntry {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
  consecutiveLockouts: number;
}

const RULES: Record<RateLimitAction, RateLimitRule> = {
  'auth:signin': {
    maxAttempts: 5,
    windowMs: 60_000, // 1 minute
    lockoutMs: 60_000, // 1 minute base lockout
    progressive: true, // 1m -> 2m -> 4m -> 8m
  },
  'auth:signup': {
    maxAttempts: 3,
    windowMs: 10 * 60_000, // 10 minutes
    lockoutMs: 10 * 60_000, // 10 minutes
    progressive: false,
  },
  'auth:forgot-password': {
    maxAttempts: 3,
    windowMs: 15 * 60_000, // 15 minutes
    lockoutMs: 15 * 60_000, // 15 minutes
    progressive: false,
  },
  'auth:reset-password': {
    maxAttempts: 5,
    windowMs: 10 * 60_000, // 10 minutes
    lockoutMs: 10 * 60_000, // 10 minutes
    progressive: true,
  },
  'action:create-shop': {
    maxAttempts: 10,
    windowMs: 60_000,
    lockoutMs: 60_000,
  },
  'action:custom-field': {
    maxAttempts: 15,
    windowMs: 60_000,
    lockoutMs: 60_000,
  },
};

const STORAGE_KEY = 'gd_rate_limits_v1';
const memoryStore: Record<string, StoredEntry> = {};

function getStore(): Record<string, StoredEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryStore;
    return JSON.parse(raw);
  } catch {
    return memoryStore;
  }
}

function saveStore(store: Record<string, StoredEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // LocalStorage unavailable (e.g. strict privacy mode)
  }
  Object.assign(memoryStore, store);
}

function makeKey(action: RateLimitAction, identifier?: string): string {
  const normId = (identifier || 'global').trim().toLowerCase();
  return `${action}:${normId}`;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
  message?: string;
}

/**
 * Check whether an action is permitted under the rate limiting policy.
 */
export function checkRateLimit(
  action: RateLimitAction,
  identifier?: string
): RateLimitCheckResult {
  const rule = RULES[action];
  if (!rule) return { allowed: true, remainingAttempts: 999, retryAfterSeconds: 0 };

  const store = getStore();
  const key = makeKey(action, identifier);
  const entry = store[key];
  const now = Date.now();

  if (!entry) {
    return {
      allowed: true,
      remainingAttempts: rule.maxAttempts,
      retryAfterSeconds: 0,
    };
  }

  // 1. Check if currently in an active lockout
  if (entry.lockedUntil && entry.lockedUntil > now) {
    const retryAfter = Math.ceil((entry.lockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: retryAfter,
      message: `Too many attempts. Please wait ${retryAfter} seconds before trying again.`,
    };
  }

  // 2. Check if sliding attempt window has expired
  if (now - entry.firstAttemptAt > rule.windowMs) {
    // Window expired, reset attempts while preserving lockout counter if progressive
    return {
      allowed: true,
      remainingAttempts: rule.maxAttempts,
      retryAfterSeconds: 0,
    };
  }

  // 3. Within window: check if attempts exceeded
  const remaining = Math.max(0, rule.maxAttempts - entry.attempts);
  if (remaining <= 0) {
    const retryAfter = Math.ceil((entry.firstAttemptAt + rule.windowMs - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds: Math.max(1, retryAfter),
      message: `Rate limit exceeded. Please wait ${retryAfter} seconds.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: remaining,
    retryAfterSeconds: 0,
  };
}

/**
 * Record an attempt. Call with success=true upon successful authentication to clear backoff.
 */
export function recordRateLimitAttempt(
  action: RateLimitAction,
  identifier?: string,
  success: boolean = false
): RateLimitCheckResult {
  const rule = RULES[action];
  if (!rule) return { allowed: true, remainingAttempts: 999, retryAfterSeconds: 0 };

  const key = makeKey(action, identifier);
  const store = getStore();
  const now = Date.now();

  if (success) {
    // Successful attempt resets the counter
    delete store[key];
    saveStore(store);
    return { allowed: true, remainingAttempts: rule.maxAttempts, retryAfterSeconds: 0 };
  }

  // Failed attempt
  const existing = store[key];
  let entry: StoredEntry;

  if (!existing || now - existing.firstAttemptAt > rule.windowMs) {
    entry = {
      attempts: 1,
      firstAttemptAt: now,
      lockedUntil: null,
      consecutiveLockouts: existing?.consecutiveLockouts || 0,
    };
  } else {
    entry = {
      ...existing,
      attempts: existing.attempts + 1,
    };
  }

  // Check if this failure triggers a lockout
  if (entry.attempts >= rule.maxAttempts) {
    entry.consecutiveLockouts += 1;
    let lockoutDuration = rule.lockoutMs;
    if (rule.progressive) {
      // Exponential penalty: 1x, 2x, 4x, 8x up to 1 hour max
      const factor = Math.min(60, Math.pow(2, entry.consecutiveLockouts - 1));
      lockoutDuration = Math.min(3600_000, rule.lockoutMs * factor);
    }
    entry.lockedUntil = now + lockoutDuration;
  }

  store[key] = entry;
  saveStore(store);

  return checkRateLimit(action, identifier);
}

/**
 * Explicitly reset rate limit for an action and identifier.
 */
export function clearRateLimit(action: RateLimitAction, identifier?: string): void {
  const key = makeKey(action, identifier);
  const store = getStore();
  delete store[key];
  saveStore(store);
}

/**
 * Returns remaining cooldown seconds if locked, or 0 if allowed.
 */
export function getRateLimitCooldown(action: RateLimitAction, identifier?: string): number {
  const res = checkRateLimit(action, identifier);
  return res.retryAfterSeconds;
}
