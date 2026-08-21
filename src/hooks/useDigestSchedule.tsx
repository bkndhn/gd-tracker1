import { useAdminSetting } from '@/hooks/useAdminSetting';

export const DIGEST_SCHEDULE_KEY = 'weekly_digest_schedule';

export interface DigestSchedule {
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  /** local hour in the chosen timezone, 0-23 */
  hour: number;
  /** minute, 0-59 */
  minute: number;
  timezone: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

export const DEFAULT_DIGEST_SCHEDULE: DigestSchedule = {
  weekday: 1,
  hour: 9,
  minute: 0,
  timezone: 'Asia/Kolkata',
  emailEnabled: true,
  inAppEnabled: true,
};

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

export function normalizeDigestSchedule(raw: any): DigestSchedule {
  const s = raw || {};
  return {
    weekday: clamp(s.weekday, 0, 6, DEFAULT_DIGEST_SCHEDULE.weekday),
    hour: clamp(s.hour, 0, 23, DEFAULT_DIGEST_SCHEDULE.hour),
    minute: clamp(s.minute, 0, 59, DEFAULT_DIGEST_SCHEDULE.minute),
    timezone: typeof s.timezone === 'string' && s.timezone ? s.timezone : DEFAULT_DIGEST_SCHEDULE.timezone,
    emailEnabled: s.emailEnabled !== false,
    inAppEnabled: s.inAppEnabled !== false,
  };
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const useDigestSchedule = () => {
  const { value, loading, save, canEdit, reload } = useAdminSetting<DigestSchedule>(
    DIGEST_SCHEDULE_KEY,
    DEFAULT_DIGEST_SCHEDULE,
    normalizeDigestSchedule,
  );
  return { schedule: value, loading, save, canEdit, reload };
};
