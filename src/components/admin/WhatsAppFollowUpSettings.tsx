import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MessageCircle, RotateCcw, Save } from 'lucide-react';
import { useFollowUpTemplates, type FollowUpSettings } from '@/hooks/useFollowUpTemplates';
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS, TEMPLATE_PLACEHOLDERS, type TemplateKey } from '@/lib/whatsappFollowUp';

/** Admin-only editor for this tenant's WhatsApp follow-up templates. */
export const WhatsAppFollowUpSettings = () => {
  const { settings, loading, save, canEdit } = useFollowUpTemplates();
  const [draft, setDraft] = useState<FollowUpSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(settings); }, [settings]);

  if (!canEdit) return null;

  const setTemplate = (key: TemplateKey, value: string) =>
    setDraft(d => ({ ...d, templates: { ...d.templates, [key]: value.slice(0, 600) } }));

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
          Smart replies used when staff follow up on a lost visit. These are saved for your organisation only.
          Placeholders: {TEMPLATE_PLACEHOLDERS.join(' ')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="h-24 animate-pulse rounded bg-muted" />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map(key => (
                <div key={key} className="space-y-1.5 min-w-0">
                  <Label className="text-xs">{TEMPLATE_LABELS[key]}</Label>
                  <Textarea
                    className="min-h-[90px] text-sm break-words"
                    value={draft.templates[key] ?? ''}
                    onChange={(e) => setTemplate(key, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Signature (optional)</Label>
              <Input
                value={draft.signature || ''}
                maxLength={120}
                placeholder="e.g. Team Sunrise Textiles"
                onChange={(e) => setDraft(d => ({ ...d, signature: e.target.value }))}
              />
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

            <div className="flex flex-wrap gap-2">
              <Button onClick={onSave} disabled={saving} size="sm">
                <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save templates'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDraft(d => ({ ...d, templates: { ...DEFAULT_TEMPLATES } }))}
              >
                <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
