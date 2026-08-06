import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Check, ChevronRight, Loader2, PartyPopper, Plus, Sparkles, Store, Tag, X } from 'lucide-react';

interface FieldRow {
  id: string;
  name: string;
  standard_key: string | null;
  display_order: number;
  optionCount: number;
}

const ONBOARDING_KEY = (userId: string) => `gd_onboarding_done_${userId}`;

const SUGGESTIONS: Record<string, string[]> = {
  shop: ['Main Branch', 'City Center', 'Warehouse'],
  category: ['Price Too High', 'Out of Stock', 'Size Not Available', 'Just Browsing'],
  size: ['Small', 'Medium', 'Large'],
  customer_type: ['Retail', 'Wholesale', 'Online'],
};

export const hasCompletedOnboarding = (userId?: string | null) =>
  !!userId && localStorage.getItem(ONBOARDING_KEY(userId)) === '1';

export const markOnboardingComplete = (userId?: string | null) => {
  if (userId) localStorage.setItem(ONBOARDING_KEY(userId), '1');
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished?: () => void;
}

/**
 * First-run setup for a new tenant: name the fields, seed their options and
 * get pointed at the next steps. Everything it writes is tenant-scoped through
 * the existing custom-field RLS policies.
 */
export const OnboardingWizard = ({ open, onOpenChange, onFinished }: Props) => {
  const { profile, user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<Record<string, string[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: fieldData, error } = await (supabase.from('custom_fields') as any)
          .select('id, name, standard_key, display_order')
          .is('deleted_at', null)
          .order('display_order');
        if (error) throw error;

        const rows: any[] = fieldData || [];
        const ids = rows.map(r => r.id);
        let counts: Record<string, number> = {};
        if (ids.length) {
          const { data: optData } = await (supabase.from('custom_field_options') as any)
            .select('custom_field_id')
            .in('custom_field_id', ids)
            .is('deleted_at', null);
          (optData || []).forEach((o: any) => {
            counts[o.custom_field_id] = (counts[o.custom_field_id] || 0) + 1;
          });
        }
        if (cancelled) return;

        const mapped: FieldRow[] = rows.map(r => ({
          id: r.id,
          name: r.name,
          standard_key: r.standard_key,
          display_order: r.display_order,
          optionCount: counts[r.id] || 0,
        }));
        setFields(mapped);
        setNames(Object.fromEntries(mapped.map(f => [f.id, f.name])));
        setOptions(Object.fromEntries(mapped.map(f => [f.id, [] as string[]])));
      } catch (e: any) {
        if (!cancelled) toast.error(e.message || 'Could not load your fields');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  const totalNewOptions = useMemo(
    () => Object.values(options).reduce((sum, list) => sum + list.length, 0),
    [options],
  );

  const addOption = (fieldId: string, value: string) => {
    const v = value.trim();
    if (!v) return;
    setOptions(prev => {
      const list = prev[fieldId] || [];
      if (list.some(x => x.toLowerCase() === v.toLowerCase())) return prev;
      return { ...prev, [fieldId]: [...list, v] };
    });
    setDrafts(prev => ({ ...prev, [fieldId]: '' }));
  };

  const removeOption = (fieldId: string, value: string) =>
    setOptions(prev => ({ ...prev, [fieldId]: (prev[fieldId] || []).filter(v => v !== value) }));

  const saveAndFinish = async () => {
    setSaving(true);
    try {
      // 1. Persist any renamed labels
      const renames = fields.filter(f => (names[f.id] || '').trim() && names[f.id].trim() !== f.name);
      for (const f of renames) {
        const { error } = await (supabase.from('custom_fields') as any)
          .update({ name: names[f.id].trim() })
          .eq('id', f.id);
        if (error) throw error;
      }

      // 2. Insert the seeded options, appended after anything that exists
      const rows: any[] = [];
      fields.forEach(f => {
        (options[f.id] || []).forEach((value, idx) => {
          rows.push({ custom_field_id: f.id, value, display_order: f.optionCount + idx });
        });
      });
      if (rows.length) {
        const { error } = await (supabase.from('custom_field_options') as any).insert(rows);
        if (error) throw error;
      }

      markOnboardingComplete(user?.id);
      toast.success(`Setup complete — ${rows.length} option${rows.length === 1 ? '' : 's'} added`);
      onFinished?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Could not save your setup');
    } finally {
      setSaving(false);
    }
  };

  const skip = () => {
    markOnboardingComplete(user?.id);
    onOpenChange(false);
  };

  const steps = ['Welcome', 'Name your fields', 'Add options', 'All set'];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) skip(); else onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Set up your GD Tracker
          </DialogTitle>
          <DialogDescription>
            Step {step + 1} of {steps.length} — {steps[step]}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-1.5" />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {step === 0 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Welcome{profile?.name ? `, ${profile.name}` : ''}. Three quick steps and your team can start
                  logging why visitors leave without buying. You can change any of this later in the Admin Panel.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: Tag, title: 'Name your fields', body: 'Call them whatever your business calls them.' },
                    { icon: Store, title: 'Add options', body: 'Branches, reasons, sizes, customer types.' },
                    { icon: PartyPopper, title: 'Invite your team', body: 'Create manager and user logins.' },
                  ].map(({ icon: Icon, title, body }) => (
                    <div key={title} className="rounded-lg border border-border/60 bg-card/60 p-3">
                      <Icon className="mb-2 h-4 w-4 text-primary" />
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  These labels appear on the entry form, dashboard, reports and exports.
                </p>
                {fields.map(f => (
                  <div key={f.id} className="grid gap-1.5">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      {f.standard_key ? f.standard_key.replace('_', ' ') : 'Custom field'}
                    </Label>
                    <Input
                      value={names[f.id] ?? ''}
                      maxLength={60}
                      onChange={e => setNames(prev => ({ ...prev, [f.id]: e.target.value }))}
                    />
                  </div>
                ))}
                {fields.length === 0 && (
                  <p className="text-sm italic text-muted-foreground">
                    No fields yet — you can create them in Admin Panel → Custom Fields.
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Add the choices your team will pick from. Press Enter to add each one.
                </p>
                {fields.map(f => {
                  const suggestions = (SUGGESTIONS[f.standard_key || ''] || []).filter(
                    s => !(options[f.id] || []).includes(s),
                  );
                  return (
                    <div key={f.id} className="rounded-lg border border-border/60 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium">{names[f.id] || f.name}</p>
                        {f.optionCount > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {f.optionCount} existing
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          placeholder={`Add ${(names[f.id] || f.name).toLowerCase()}…`}
                          value={drafts[f.id] || ''}
                          maxLength={80}
                          onChange={e => setDrafts(prev => ({ ...prev, [f.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addOption(f.id, drafts[f.id] || '');
                            }
                          }}
                        />
                        <Button type="button" variant="outline" size="icon" onClick={() => addOption(f.id, drafts[f.id] || '')}>
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {(options[f.id] || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {options[f.id].map(v => (
                            <Badge key={v} variant="default" className="gap-1 pr-1">
                              {v}
                              <button
                                type="button"
                                onClick={() => removeOption(f.id, v)}
                                className="rounded-full p-0.5 hover:bg-background/20"
                                aria-label={`Remove ${v}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}

                      {suggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">Suggestions:</span>
                          {suggestions.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => addOption(f.id, s)}
                              className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                            >
                              + {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3 py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">You're ready to go</h3>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  {totalNewOptions > 0
                    ? `${totalNewOptions} option${totalNewOptions === 1 ? '' : 's'} will be added.`
                    : 'No new options added — you can add them any time.'}{' '}
                  Next, head to Admin Panel → Users to invite your managers and staff, and Export Settings to
                  choose the columns for your PDF and Excel reports.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-4">
          <Button variant="ghost" size="sm" onClick={skip} disabled={saving}>
            Skip setup
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} disabled={saving}>
                Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button size="sm" onClick={() => setStep(s => s + 1)} disabled={loading} className="gap-1">
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={saveAndFinish} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Finish setup
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
