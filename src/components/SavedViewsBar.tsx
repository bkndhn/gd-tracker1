import { useState } from 'react';
import { Bookmark, BookmarkPlus, Check, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SavedView, SavedViewPage, SavedViewScope, useSavedViews } from '@/hooks/useSavedViews';
import { useTranslation } from '@/i18n';

interface Props {
  page: SavedViewPage;
  /** Current filter state to persist when saving. */
  getFilters: () => Record<string, any>;
  /** Apply a previously saved filter state. */
  onApply: (filters: Record<string, any>) => void;
  /** Called once on mount with the user's default view (if any). */
  onDefaultLoaded?: (filters: Record<string, any>) => void;
}

export const SavedViewsBar = ({ page, getFilters, onApply, onDefaultLoaded }: Props) => {
  const { t } = useTranslation();
  const { views, saveView, deleteView, setDefaultView, canShareTenant, hasShop } = useSavedViews(page);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<SavedViewScope>('private');
  const [makeDefault, setMakeDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [defaultApplied, setDefaultApplied] = useState(false);

  // Auto-apply the user's default view once views arrive
  if (!defaultApplied && views.length > 0) {
    const def = views.find(v => v.is_default);
    setDefaultApplied(true);
    if (def && onDefaultLoaded) {
      setAppliedId(def.id);
      onDefaultLoaded(def.filters || {});
    }
  }

  const handleSave = async () => {
    setSaving(true);
    const created = await saveView(name, getFilters(), scope, makeDefault);
    setSaving(false);
    if (created) {
      setOpen(false);
      setName('');
      setScope('private');
      setMakeDefault(false);
      setAppliedId(created.id);
    }
  };

  const apply = (v: SavedView) => {
    setAppliedId(v.id);
    onApply(v.filters || {});
  };

  const scopeLabel = (s: SavedViewScope) =>
    s === 'private' ? t('views.scope.private') : s === 'shop' ? t('views.scope.shop') : t('views.scope.tenant');

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            <span className="truncate max-w-[10rem]">
              {views.find(v => v.id === appliedId)?.name || t('views.saved')}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="z-50 w-72 bg-popover">
          <DropdownMenuLabel>{t('views.saved')}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {views.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">{t('views.empty')}</div>
          )}
          {views.map(v => (
            <div key={v.id} className="flex items-center gap-1 px-1">
              <DropdownMenuItem className="flex-1 min-w-0" onClick={() => apply(v)}>
                <span className="truncate">{v.name}</span>
                {v.is_default && <Star className="h-3 w-3 ml-1 fill-primary text-primary shrink-0" />}
                {appliedId === v.id && <Check className="h-3 w-3 ml-1 text-primary shrink-0" />}
                <Badge variant="secondary" className="ml-auto text-[10px] shrink-0">{scopeLabel(v.scope)}</Badge>
              </DropdownMenuItem>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                aria-label={t('views.setDefault')}
                onClick={(e) => { e.preventDefault(); void setDefaultView(v.id); }}
              >
                <Star className={`h-3.5 w-3.5 ${v.is_default ? 'fill-primary text-primary' : ''}`} />
              </Button>
              <Button
                variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive"
                aria-label={t('common.delete')}
                onClick={(e) => { e.preventDefault(); void deleteView(v.id); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="ghost" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <BookmarkPlus className="h-4 w-4" />
        <span className="hidden sm:inline">{t('views.save')}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('views.save')}</DialogTitle>
            <DialogDescription>{t('views.scope')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">{t('views.name')}</Label>
              <Input
                id="view-name" value={name} maxLength={60}
                placeholder={t('views.namePlaceholder')}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('views.scope')}</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as SavedViewScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="private">{t('views.scope.private')}</SelectItem>
                  {hasShop && <SelectItem value="shop">{t('views.scope.shop')}</SelectItem>}
                  {canShareTenant && <SelectItem value="tenant">{t('views.scope.tenant')}</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="view-default" className="cursor-pointer">{t('views.setDefault')}</Label>
              <Switch id="view-default" checked={makeDefault} onCheckedChange={setMakeDefault} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
