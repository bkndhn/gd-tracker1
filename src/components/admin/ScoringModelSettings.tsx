import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SlidersHorizontal } from 'lucide-react';
import { useScoringWeights } from '@/hooks/useScoringWeights';
import { DEFAULT_SCORING_WEIGHTS, type FixKind, type ScoringWeights } from '@/lib/lostSaleInsights';

const SIGNALS: Array<{ key: keyof Omit<ScoringWeights, 'kindMultiplier'>; label: string; help: string }> = [
  { key: 'volume', label: 'Volume', help: 'How many lost visits this item caused in the last 7 days, compared to the busiest item.' },
  { key: 'value', label: 'Money at stake', help: 'Visits × your average recovered amount per converted follow-up.' },
  { key: 'trend', label: 'Getting worse', help: 'How much the item increased versus the previous 7 days.' },
  { key: 'recency', label: 'Recency', help: 'Newer visits score higher; a 7-day-old average scores zero.' },
];

const KINDS: Array<{ key: FixKind; label: string; help: string }> = [
  { key: 'reason', label: 'Lost reasons', help: 'Ranks the reason customers walked out — "most costly".' },
  { key: 'shop', label: 'Shops', help: 'Ranks branches by lost visits — the "worst shop".' },
  { key: 'staff', label: 'Staff coaching', help: 'Ranks reporters whose visits keep ending in no sale — "coaching needed".' },
];

export const ScoringModelSettings = () => {
  const { weights, loading, save, canEdit } = useScoringWeights();
  const [draft, setDraft] = useState<ScoringWeights>(weights);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(weights); }, [weights]);

  if (!canEdit) return null;

  const total = draft.volume + draft.value + draft.trend + draft.recency;

  const commit = async () => {
    try {
      setSaving(true);
      await save(draft);
      toast.success('Scoring model updated');
    } catch (e) {
      toast.error((e as Error).message || 'Could not save weights');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" /> Fix scoring model
        </CardTitle>
        <CardDescription>
          Every "Top 3 fixes" item gets a score of{' '}
          <span className="font-medium">volume + money at stake + trend + recency</span>, each normalised to 0–100%
          and multiplied by the weight below, then by the dimension multiplier. Highest score wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="space-y-4">
              {SIGNALS.map(sig => (
                <div key={sig.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{sig.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {draft[sig.key]} pts · {total ? Math.round((draft[sig.key] / total) * 100) : 0}%
                    </Badge>
                  </div>
                  <Slider
                    value={[draft[sig.key]]}
                    min={0}
                    max={100}
                    step={5}
                    onValueChange={([v]) => setDraft(d => ({ ...d, [sig.key]: v }))}
                  />
                  <p className="text-xs text-muted-foreground">{sig.help}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4 border-t pt-4">
              <p className="text-sm font-semibold">Dimension multipliers</p>
              {KINDS.map(kind => (
                <div key={kind.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{kind.label}</span>
                    <Badge variant="outline" className="text-xs">×{draft.kindMultiplier[kind.key].toFixed(1)}</Badge>
                  </div>
                  <Slider
                    value={[draft.kindMultiplier[kind.key] * 10]}
                    min={0}
                    max={20}
                    step={1}
                    onValueChange={([v]) =>
                      setDraft(d => ({ ...d, kindMultiplier: { ...d.kindMultiplier, [kind.key]: v / 10 } }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">{kind.help}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={commit} disabled={saving}>
                {saving ? 'Saving…' : 'Save weights'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(DEFAULT_SCORING_WEIGHTS)}>
                Reset to defaults
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
