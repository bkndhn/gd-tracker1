import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { formatISTDate } from '@/lib/dateUtils';
import { useAuth } from '@/hooks/useAuth';

import { AppLogo } from '@/components/AppLogo';

interface ChangelogRow {
  id: string;
  version: string | null;
  title: string;
  body: string;
  created_at: string;
}

const seenKey = (uid: string) => `lsi_changelog_seen_${uid}`;

/** "What's new" bell showing changelog entries published since the user last looked. */
export const WhatsNew = () => {
  const { profile } = useAuth();
  const [rows, setRows] = useState<ChangelogRow[]>([]);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        const { data } = await (supabase.from('changelog') as any)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        const list = (data || []) as ChangelogRow[];
        setRows(list);
        const lastSeen = localStorage.getItem(seenKey(profile.id));
        setUnread(list.filter(r => !lastSeen || r.created_at > lastSeen).length);
      } catch (e) {
        if (import.meta.env.DEV) console.error('WhatsNew', e);
      }
    })();
  }, [profile?.id]);

  const markSeen = (v: boolean) => {
    setOpen(v);
    if (v && profile?.id) {
      localStorage.setItem(seenKey(profile.id), new Date().toISOString());
      setUnread(0);
    }
  };

  if (!profile?.id || rows.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={markSeen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="What's new">
          <Sparkles className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <AppLogo variant="icon" pixelSize={18} />
          <p className="text-sm font-semibold">What's new</p>
        </div>
        <ScrollArea className="max-h-96">
          <div className="space-y-3 p-4">
            {rows.map(r => (
              <div key={r.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.version && <Badge variant="outline" className="text-[9px]">{r.version}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{r.body}</p>
                <p className="text-[10px] text-muted-foreground/70">{formatISTDate(r.created_at)}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
