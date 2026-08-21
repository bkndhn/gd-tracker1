import { useCallback } from 'react';
import { useAdminSetting } from '@/hooks/useAdminSetting';
import {
  DEFAULT_SCORING_WEIGHTS,
  normalizeWeights,
  type ScoringWeights,
} from '@/lib/lostSaleInsights';

export const SCORING_WEIGHTS_KEY = 'insight_scoring_weights';

/**
 * Per-admin scoring weights for the "Top 3 fixes" ranking.
 * Stored in app_settings scoped by admin_id so every tenant tunes its own model,
 * with every change written to settings_audit_log.
 */
export const useScoringWeights = () => {
  const { value, loading, save, canEdit, reload } = useAdminSetting<ScoringWeights>(
    SCORING_WEIGHTS_KEY,
    DEFAULT_SCORING_WEIGHTS,
    (raw) => normalizeWeights(raw),
  );

  const persist = useCallback((next: ScoringWeights, note?: string) => save(next, note), [save]);

  return {
    weights: value,
    loading,
    save: persist,
    reload,
    reset: () => persist(DEFAULT_SCORING_WEIGHTS, 'Reset to defaults'),
    canEdit,
  };
};
