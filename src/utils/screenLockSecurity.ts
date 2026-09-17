/**
 * Screen Lock & Inactivity Security Utilities
 *
 * Implements bank-grade screen lock and inactivity management:
 * - Configurable inactivity timeout (5m, 15m, 30m, or Disabled)
 * - Cryptographic SHA-256 Quick PIN hashing via Web Crypto API
 * - Persistent lock state across browser tab reloads
 */

const LOCKOUT_KEY = 'gd_lockout_timeout_ms';
const LOCK_STATE_KEY = 'gd_screen_locked';
const PIN_PREFIX = 'gd_quick_pin_';

// Default: 15 minutes (900,000 ms)
export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

export const TIMEOUT_OPTIONS = [
  { label: '5 minutes', value: 5 * 60 * 1000 },
  { label: '15 minutes (Bank standard)', value: 15 * 60 * 1000 },
  { label: '30 minutes', value: 30 * 60 * 1000 },
  { label: 'Never (Disabled)', value: 0 },
];

export function getLockoutTimeout(): number {
  try {
    const val = localStorage.getItem(LOCKOUT_KEY);
    if (val !== null) {
      const num = Number(val);
      if (!isNaN(num)) return num;
    }
  } catch {
    // fallback
  }
  return DEFAULT_TIMEOUT_MS;
}

export function setLockoutTimeout(ms: number): void {
  try {
    localStorage.setItem(LOCKOUT_KEY, String(ms));
  } catch {
    // ignore
  }
}

export function isScreenLocked(): boolean {
  try {
    return sessionStorage.getItem(LOCK_STATE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setScreenLocked(locked: boolean): void {
  try {
    if (locked) {
      sessionStorage.setItem(LOCK_STATE_KEY, '1');
    } else {
      sessionStorage.removeItem(LOCK_STATE_KEY);
    }
  } catch {
    // ignore
  }
}

export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(`gd_pin_salt_${pin}_2026`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasQuickPin(userId: string): boolean {
  try {
    return !!localStorage.getItem(`${PIN_PREFIX}${userId}`);
  } catch {
    return false;
  }
}

export async function setQuickPin(userId: string, pin: string): Promise<void> {
  const hash = await hashPin(pin);
  try {
    localStorage.setItem(`${PIN_PREFIX}${userId}`, hash);
  } catch {
    // ignore
  }
}

export async function verifyQuickPin(userId: string, pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(`${PIN_PREFIX}${userId}`);
    if (!stored) return false;
    const computed = await hashPin(pin);
    return stored === computed;
  } catch {
    return false;
  }
}

export function clearQuickPin(userId: string): void {
  try {
    localStorage.removeItem(`${PIN_PREFIX}${userId}`);
  } catch {
    // ignore
  }
}
