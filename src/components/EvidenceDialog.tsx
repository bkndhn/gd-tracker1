import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { useEntryEvidence, ALLOWED_EVIDENCE_TYPES } from '@/hooks/useEntryEvidence';

interface EvidenceDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entryId: string | null;
  title?: string;
  onChanged?: () => void;
}

export const EvidenceDialog = ({ open, onOpenChange, entryId, title, onChanged }: EvidenceDialogProps) => {
  const { items, loading, uploading, upload, remove } = useEntryEvidence(open ? entryId : null);
  const [caption, setCaption] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await upload(file, caption.trim() || undefined);
        toast.success(`${file.name} attached`);
      } catch (e) {
        toast.error((e as Error).message || 'Upload failed');
      }
    }
    setCaption('');
    if (inputRef.current) inputRef.current.value = '';
    onChanged?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[96vw] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4 text-primary" /> Evidence {title ? `— ${title}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Optional caption for the next upload"
              className="h-9 flex-1 min-w-[180px] text-xs"
            />
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ALLOWED_EVIDENCE_TYPES.join(',')}
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />
            <Button size="sm" className="h-9 gap-1 text-xs" disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Attach image / PDF
            </Button>
          </div>

          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading evidence…</p>
          ) : items.length === 0 ? (
            <p className="rounded-md border border-dashed py-8 text-center text-xs text-muted-foreground">
              No evidence attached yet. Images and PDFs up to 10 MB are supported.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map(item => {
                const isImage = item.mime_type.startsWith('image/');
                return (
                  <div key={item.id} className="overflow-hidden rounded-lg border">
                    {isImage ? (
                      <button
                        type="button"
                        className="block w-full"
                        onClick={() => setPreview(item.url)}
                      >
                        <img src={item.url} alt={item.file_name} loading="lazy" className="h-36 w-full object-cover" />
                      </button>
                    ) : (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-36 w-full flex-col items-center justify-center gap-2 bg-muted/50 text-xs text-muted-foreground"
                      >
                        <FileText className="h-8 w-8 text-primary" />
                        Open PDF
                      </a>
                    )}
                    <div className="space-y-1 p-2">
                      <p className="truncate text-xs font-medium">{item.file_name}</p>
                      {item.caption && <p className="truncate text-[11px] text-muted-foreground">{item.caption}</p>}
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {format(new Date(item.created_at), 'dd MMM yyyy')} · {Math.max(1, Math.round(item.file_size / 1024))} KB
                        </Badge>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={async () => {
                            try {
                              await remove(item);
                              toast.success('Evidence removed');
                              onChanged?.();
                            } catch (e) {
                              toast.error((e as Error).message || 'Could not remove');
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <Dialog open={!!preview} onOpenChange={v => !v && setPreview(null)}>
          <DialogContent className="max-w-3xl p-2">
            {preview && <img src={preview} alt="Evidence preview" className="max-h-[80vh] w-full object-contain" />}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
};
