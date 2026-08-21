import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { FileText, ImageIcon, Trash2 } from 'lucide-react';
import { useExportTemplate } from '@/hooks/useExportTemplate';
import { DEFAULT_EXPORT_TEMPLATE, type ExportTemplate } from '@/lib/reportTemplate';
import { exportTableToPDF } from '@/lib/insightExports';

const MAX_LOGO_BYTES = 200 * 1024;

export const ExportTemplateSettings = () => {
  const { template, loading, save, canEdit } = useExportTemplate();
  const [draft, setDraft] = useState<ExportTemplate>(template);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(template); }, [template]);

  if (!canEdit) return null;

  const pickLogo = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Logo must be an image'); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error('Logo must be under 200 KB'); return; }
    const reader = new FileReader();
    reader.onload = () => setDraft(d => ({ ...d, logoDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const commit = async () => {
    try {
      setSaving(true);
      await save(draft, 'Export template updated');
      toast.success('Export template saved');
    } catch (e) {
      toast.error((e as Error).message || 'Could not save template');
    } finally {
      setSaving(false);
    }
  };

  const previewPdf = () => {
    exportTableToPDF({
      title: 'Export template preview',
      subtitle: 'Sample report — this is how your exports will look',
      columns: ['Category', 'Size', 'Misses', 'Shops'],
      rows: [
        ['Shirts', 'M', 12, 'Main branch'],
        ['Jeans', '32', 8, 'Main branch, City mall'],
      ],
      fileName: 'export-template-preview',
    }, draft);
  };

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" /> Export template
        </CardTitle>
        <CardDescription>
          Branding applied to every PDF and Excel export — Stock &amp; Size Gap and each Top 3 Fixes drill-down.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Shop / business name</Label>
                <Input
                  value={draft.orgName}
                  onChange={e => setDraft(d => ({ ...d, orgName: e.target.value }))}
                  placeholder="e.g. Sri Textiles, Coimbatore"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Accent colour</Label>
                <Input
                  type="color"
                  value={draft.accentColor}
                  onChange={e => setDraft(d => ({ ...d, accentColor: e.target.value }))}
                  className="h-9 w-24 p-1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Custom header note</Label>
              <Textarea
                value={draft.headerNote}
                onChange={e => setDraft(d => ({ ...d, headerNote: e.target.value }))}
                placeholder="Shown under the report title"
                className="min-h-[60px] text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Custom footer note</Label>
              <Textarea
                value={draft.footerNote}
                onChange={e => setDraft(d => ({ ...d, footerNote: e.target.value }))}
                placeholder="e.g. Confidential — internal use only"
                className="min-h-[60px] text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {draft.logoDataUrl ? (
                <img src={draft.logoDataUrl} alt="Logo preview" className="h-12 w-auto rounded border bg-white p-1" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => pickLogo(e.target.files?.[0])}
              />
              <Button size="sm" variant="outline" className="text-xs" onClick={() => fileRef.current?.click()}>
                Upload logo
              </Button>
              {draft.logoDataUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-xs text-destructive"
                  onClick={() => setDraft(d => ({ ...d, logoDataUrl: null }))}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground">PNG/JPG under 200 KB</span>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={draft.showDateRange}
                onCheckedChange={v => setDraft(d => ({ ...d, showDateRange: v }))}
              />
              <Label className="text-xs">Print the report date range in the header</Label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={commit} disabled={saving}>{saving ? 'Saving…' : 'Save template'}</Button>
              <Button size="sm" variant="outline" onClick={previewPdf}>Preview PDF</Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(DEFAULT_EXPORT_TEMPLATE)}>Reset</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
