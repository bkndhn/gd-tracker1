import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { MessageCircle, RotateCcw, Save } from 'lucide-react';
import { useFollowUpTemplates, type FollowUpSettings } from '@/hooks/useFollowUpTemplates';
import {
  DEFAULT_TEMPLATES_BY_LOCALE, TEMPLATE_LABELS, TEMPLATE_LOCALE_LABELS, TEMPLATE_PLACEHOLDERS,
  type TemplateKey, type TemplateLocale,
} from '@/lib/whatsappFollowUp';

const LOCALES: TemplateLocale[] = ['en', 'ta', 'hi'];

/** Admin-only editor for this tenant's WhatsApp follow-up templates. */
export const WhatsAppFollowUpSettings = () => {
  const { settings, loading, save, canEdit } = useFollowUpTemplates();
  const [draft, setDraft] = useState<FollowUpSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(settings); }, [settings]);

  if (!canEdit) return null;

  const setTemplate = (locale: TemplateLocale, key: TemplateKey, value: string) =>
    setDraft(d => ({
      ...d,
      templatesByLocale: {
        ...d.templatesByLocale,
        [locale]: { ...d.templatesByLocale[locale], [key]: value.slice(0, 600) },
      },
    }));

  const onSave = async () => {
    try {
      setSaving(true);
      await save(draft);
      toast.success('Follow-up templates saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save templates');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4 text-green-600" />
          WhatsApp follow-up templates
        </CardTitle>
        <CardDescription>
          Smart replies used when staff follow up on a lost visit, in English, Tamil and Hindi.
          Saved for your organisation only. Placeholders: {TEMPLATE_PLACEHOLDERS.join(' ')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-24 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <Tabs value={draft.locale} onValueChange={(v) => setDraft(d => ({ ...d, locale: v as TemplateLocale }))}>
              <TabsList>
                {LOCALES.map(l => <TabsTrigger key={l} value={l}>{TEMPLATE_LOCALE_LABELS[l]}</TabsTrigger>)}
              </TabsList>
              {LOCALES.map(locale => (
                <TabsContent key={locale} value={locale} className="mt-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map(key => (
                      <div key={key} className="space-y-1.5 min-w-0">
                        <Label className="text-xs">{TEMPLATE_LABELS[key]}</Label>
                        <Textarea
                          className="min-h-[90px] text-sm break-words"
                          value={draft.templatesByLocale?.[locale]?.[key] ?? ''}
                          onChange={(e) => setTemplate(locale, key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setDraft(d => ({
                      ...d,
                      templatesByLocale: { ...d.templatesByLocale, [locale]: { ...DEFAULT_TEMPLATES_BY_LOCALE[locale] } },
                    }))}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" /> Reset {TEMPLATE_LOCALE_LABELS[locale]} defaults
                  </Button>
                </TabsContent>
              ))}
            </Tabs>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Signature (optional)</Label>
                <Input
                  value={draft.signature || ''}
                  maxLength={120}
                  placeholder="e.g. Team Sunrise Textiles"
                  onChange={(e) => setDraft(d => ({ ...d, signature: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reminder cadence (days after sending)</Label>
                <Input
                  inputMode="numeric"
                  value={String(draft.reminderDays ?? 3)}
                  onChange={(e) => setDraft(d => ({ ...d, reminderDays: Math.min(30, Math.max(1, Number(e.target.value.replace(/\D/g, '') || 1))) }))}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <Label className="text-sm">Mention detected spikes</Label>
                <p className="text-xs text-muted-foreground">
                  Adds a short line when this shop/reason is trending above normal.
                </p>
              </div>
              <Switch
                checked={draft.includeAnomalyNote}
                onCheckedChange={(v) => setDraft(d => ({ ...d, includeAnomalyNote: v }))}
              />
            </div>

            <Button onClick={onSave} disabled={saving} size="sm">
              <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
