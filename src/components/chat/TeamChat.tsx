import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageCircle, Send, Store } from 'lucide-react';
import { toast } from 'sonner';

type Msg = {
  id: string; admin_id: string; shop_id: string; sender_id: string;
  sender_name: string | null; sender_role: string | null; message: string; created_at: string;
};
type Shop = { id: string; name: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function TeamChat({ compact = false }: { compact?: boolean }) {
  const { profile } = useAuth();
  const role = profile?.role ?? '';
  const isHub = role === 'admin' || role === 'warehouse';
  const tenantId = role === 'admin' ? profile?.id : profile?.admin_id;

  const [shops, setShops] = useState<Shop[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeShop, setActiveShop] = useState<string | null>(isHub ? null : profile?.shop_id ?? null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tenantId) return;
    supabase.from('shops').select('id,name').eq('admin_id', tenantId).is('deleted_at', null).order('name')
      .then(({ data }) => setShops((data as Shop[]) ?? []));
    db.from('team_messages').select('*').eq('admin_id', tenantId)
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data }: { data: Msg[] | null }) => setMessages((data ?? []).reverse()));

    const channel = supabase
      .channel(`team-chat-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `admin_id=eq.${tenantId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  const threads = useMemo(() => {
    const visible = isHub ? shops : shops.filter((s) => s.id === profile?.shop_id);
    return visible.map((s) => {
      const list = messages.filter((m) => m.shop_id === s.id);
      return { ...s, last: list[list.length - 1] };
    }).sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''));
  }, [shops, messages, isHub, profile?.shop_id]);

  const thread = messages.filter((m) => m.shop_id === activeShop);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread.length, activeShop]);

  const send = async () => {
    const body = text.trim();
    if (!body || !activeShop || !tenantId || !profile) return;
    setSending(true);
    const { data, error } = await db.from('team_messages').insert({
      admin_id: tenantId, shop_id: activeShop, sender_id: profile.id,
      sender_name: profile.name, sender_role: role, message: body.slice(0, 2000),
    }).select().single();
    setSending(false);
    if (error) { toast.error('Message not sent. Please try again.'); return; }
    setText('');
    setMessages((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data]));
  };

  if (!isHub && !profile?.shop_id) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">You need to be assigned to a shop to use chat.</Card>;
  }

  const showList = isHub && !activeShop;
  const shopName = shops.find((s) => s.id === activeShop)?.name ?? 'Shop';
  const height = compact ? 'h-[calc(100dvh-8rem)]' : 'h-[70dvh] min-h-[460px]';

  return (
    <Card className={`flex overflow-hidden rounded-2xl ${height}`}>
      {isHub && (
        <aside className={`${showList ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 flex-col border-r`}>
          <div className="flex items-center gap-2 border-b p-4 font-semibold">
            <MessageCircle className="h-5 w-5 text-primary" /> Shop chats
          </div>
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 && <p className="p-4 text-sm text-muted-foreground">No shops yet.</p>}
            {threads.map((t) => (
              <button key={t.id} onClick={() => setActiveShop(t.id)}
                className={`flex min-h-[64px] w-full items-center gap-3 border-b px-4 py-3 text-left transition active:bg-muted ${activeShop === t.id ? 'bg-primary/10' : 'hover:bg-muted/60'}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Store className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.last ? `${t.last.sender_name ?? ''}: ${t.last.message}` : 'No messages yet'}</p>
                </div>
              </button>
            ))}
          </div>
        </aside>
      )}

      <section className={`${showList ? 'hidden lg:flex' : 'flex'} min-w-0 flex-1 flex-col`}>
        {activeShop ? (
          <>
            <header className="flex items-center gap-2 border-b bg-primary px-3 py-3 text-primary-foreground">
              {isHub && (
                <Button variant="ghost" size="icon" className="h-10 w-10 lg:hidden text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setActiveShop(null)} aria-label="Back to chats">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{isHub ? shopName : 'Admin & warehouse'}</p>
                <p className="text-xs opacity-80">{isHub ? 'Shop staff chat' : shopName}</p>
              </div>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto bg-muted/40 p-3">
              {thread.length === 0 && <p className="mt-10 text-center text-sm text-muted-foreground">Say hello 👋</p>}
              {thread.map((m) => {
                const mine = m.sender_id === profile?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm ${mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-card'}`}>
                      {!mine && (
                        <p className="mb-0.5 flex items-center gap-1 text-xs font-semibold text-primary">
                          {m.sender_name ?? 'User'} {m.sender_role && <Badge variant="secondary" className="h-4 px-1 text-[10px] capitalize">{m.sender_role}</Badge>}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.message}</p>
                      <p className={`mt-1 text-right text-[10px] ${mine ? 'opacity-80' : 'text-muted-foreground'}`}>{timeLabel(m.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <form className="flex gap-2 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]" onSubmit={(e) => { e.preventDefault(); send(); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type a message" className="h-12 rounded-full" />
              <Button type="submit" size="icon" disabled={sending || !text.trim()} className="h-12 w-12 shrink-0 rounded-full" aria-label="Send">
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">Pick a shop to start chatting</div>
        )}
      </section>
    </Card>
  );
}
