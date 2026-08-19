import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DEFAULT_SCORING_WEIGHTS,
  normalizeWeights,
  type ScoringWeights,
} from '@/lib/lostSaleInsights';

export const SCORING_WEIGHTS_KEY = 'insight_scoring_weights';

/**
 * Per-admin scoring weights for the "Top 3 fixes" ranking.
 * Stored in app_settings scoped by admin_id so every tenant tunes its own model.
 */
export const useScoringWeights = () => {
  const { profile } = useAuth();
  const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_SCORING_WEIGHTS);
  const [loading, setLoading] = useState(true);

  const role = (profile as any)?.role;
  const adminId = role === 'admin' || role === 'super_admin' ? profile?.id : (profile as any)?.admin_id;

  const load = useCallback(async () => {
    if (!adminId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', SCORING_WEIGHTS_KEY)
        .eq('admin_id', adminId)
        .maybeSingle();
      setWeights(normalizeWeights((data?.value as any) || null));
    } catch (e) {
      if (import.meta.env.DEV) console.error('useScoringWeights error', e);
    } finally {
      setLoading(false);
    }
  }, [adminId]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (next: ScoringWeights) => {
    if (!adminId) throw new Error('No admin context');
    const value = normalizeWeights(next);
    const { error } = await (supabase.from('app_settings') as any).upsert(
      { key: SCORING_WEIGHTS_KEY, admin_id: adminId, value },
      { onConflict: 'admin_id,key' },
    );
    if (error) throw error;
    setWeights(value);
  }, [adminId]);

  return {
    weights,
    loading,
    save,
    reset: () => save(DEFAULT_SCORING_WEIGHTS),
    canEdit: !!adminId && (role === 'admin' || role === 'super_admin'),
  };
};
