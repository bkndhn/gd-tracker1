/** Reset rules that decide which follow-ups count towards the leaderboard. */
export type LeaderboardReset = 'monthly' | 'quarterly' | 'rolling30' | 'rolling90' | 'all';

export const RESET_LABELS: Record<LeaderboardReset, string> = {
  monthly: 'Reset every month (1st)',
  quarterly: 'Reset every quarter',
  rolling30: 'Rolling last 30 days',
  rolling90: 'Rolling last 90 days',
  all: 'Never reset (all time)',
};

/** Start timestamp (ms) of the current leaderboard window for a reset rule. */
export const periodStart = (rule: LeaderboardReset, now = new Date()): number => {
  switch (rule) {
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case 'quarterly':
      return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime();
    case 'rolling30':
      return now.getTime() - 30 * 86400000;
    case 'rolling90':
      return now.getTime() - 90 * 86400000;
    default:
      return 0;
  }
};

export const periodLabel = (rule: LeaderboardReset, now = new Date()): string => {
  switch (rule) {
    case 'monthly':
      return now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    case 'quarterly':
      return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
    case 'rolling30':
      return 'Last 30 days';
    case 'rolling90':
      return 'Last 90 days';
    default:
      return 'All time';
  }
};

export const normalizeReset = (raw: any): LeaderboardReset => {
  const v = typeof raw === 'string' ? raw : raw?.rule;
  return (['monthly', 'quarterly', 'rolling30', 'rolling90', 'all'] as const).includes(v) ? v : 'monthly';
};
