import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Activity, AlertTriangle, HeartPulse, Loader2, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { APP_RELEASE } from '@/lib/errorTracking';

interface ErrorRow {
  id: string;
  release: string;
  environment: string;
  level: string;
  kind: string;
  message: string;
  stack: string | null;
  component_stack: string | null;
  url: string | null;
  user_agent: string | null;
  user_id: string | null;
  fingerprint: string;
  created_at: string;
}

interface SessionRow {
  session_id: string;
  user_id: string | null;
  release: string;
  errored: boolean;
  crashed: boolean;
  started_at: string;
}

const WINDOWS: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };

/**
 * Release health: crash-free sessions/users per release plus grouped crash
 * reports, sourced from the app's own telemetry tables.
 */
export const ReleaseHealthPanel = () => {
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowKey, setWindowKey] = useState('7d');
  const [release, setRelease] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - WINDOWS[windowKey] * 86_400_000).toISOString();
      const [errRes, sesRes] = await Promise.all([
        (supabase.from('client_errors') as any)
          .select('*')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(500),
        (supabase.from('app_sessions') as any)
          .select('session_id, user_id, release, errored, crashed, started_at')
          .gte('started_at', since)
          .order('started_at', { ascending: false })
          .limit(2000),
      ]);
      setErrors(errRes.data || []);
      setSessions(sesRes.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [windowKey]);

  const releases = useMemo(() => {
    const set = new Set<string>([APP_RELEASE]);
    sessions.forEach(s => set.add(s.release));
    errors.forEach(e => set.add(e.release));
    return Array.from(set).sort().reverse();
  }, [sessions, errors]);

  const scopedSessions = release === 'all' ? sessions : sessions.filter(s => s.release === release);
  const scopedErrors = release === 'all' ? errors : errors.filter(e => e.release === release);

  const stats = useMemo(() => {
    const total = scopedSessions.length;
    const crashed = scopedSessions.filter(s => s.crashed).length;
    const errored = scopedSessions.filter(s => s.errored).length;
    const users = new Set(scopedSessions.map(s => s.user_id).filter(Boolean));
    const crashedUsers = new Set(scopedSessions.filter(s => s.crashed).map(s => s.user_id).filter(Boolean));
    return {
      total,
      crashFreeSessions: total ? ((total - crashed) / total) * 100 : 100,
      errorFreeSessions: total ? ((total - errored) / total) * 100 : 100,
      crashFreeUsers: users.size ? ((users.size - crashedUsers.size) / users.size) * 100 : 100,
      users: users.size,
      crashes: scopedErrors.filter(e => e.level === 'fatal').length,
      events: scopedErrors.length,
    };
  }, [scopedSessions, scopedErrors]);

  const groups = useMemo(() => {
    const map = new Map<string, { sample: ErrorRow; count: number; users: Set<string>; last: string }>();
    scopedErrors.forEach(e => {
      const g = map.get(e.fingerprint);
      if (g) {
        g.count += 1;
        if (e.user_id) g.users.add(e.user_id);
        if (e.created_at > g.last) g.last = e.created_at;
      } else {
        map.set(e.fingerprint, {
          sample: e,
          count: 1,
          users: new Set(e.user_id ? [e.user_id] : []),
          last: e.created_at,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [scopedErrors]);

  const health = (pct: number) =>
    pct >= 99.5 ? 'text-emerald-500' : pct >= 98 ? 'text-amber-500' : 'text-destructive';

  return (
    <Card className="premium-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" /> Release Health
            </CardTitle>
            <CardDescription>
              Crash-free rates and grouped error reports across every tenant. Current build: {APP_RELEASE}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={release} onValueChange={setRelease}>
              <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All releases</SelectItem>
                {releases.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={windowKey} onValueChange={setWindowKey}>
              <SelectTrigger className="h-9 w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Crash-free sessions', value: `${stats.crashFreeSessions.toFixed(2)}%`, icon: ShieldCheck, tone: health(stats.crashFreeSessions) },
            { label: 'Crash-free users', value: `${stats.crashFreeUsers.toFixed(2)}%`, icon: Users, tone: health(stats.crashFreeUsers) },
            { label: 'Error-free sessions', value: `${stats.errorFreeSessions.toFixed(2)}%`, icon: Activity, tone: health(stats.errorFreeSessions) },
            { label: 'Events captured', value: `${stats.events}`, icon: AlertTriangle, tone: stats.crashes ? 'text-destructive' : 'text-muted-foreground' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="rounded-xl border border-border/60 bg-card/60 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className={`h-3.5 w-3.5 ${tone}`} /> {label}
              </div>
              <p className={`text-xl font-semibold ${tone}`}>{value}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Based on {stats.total} session{stats.total === 1 ? '' : 's'} from {stats.users} user
          {stats.users === 1 ? '' : 's'} · {stats.crashes} fatal crash{stats.crashes === 1 ? '' : 'es'}
        </p>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 py-10 text-center">
            <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium">No errors reported in this window</p>
            <p className="text-xs text-muted-foreground">Everything is running clean.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px] pr-3">
            <Accordion type="single" collapsible className="space-y-2">
              {groups.map((g, i) => (
                <AccordionItem key={g.sample.fingerprint} value={`g-${i}`} className="rounded-lg border border-border/60 px-3">
                  <AccordionTrigger className="py-3 hover:no-underline">
                    <div className="flex w-full items-center gap-3 pr-2 text-left">
                      <Badge variant={g.sample.level === 'fatal' ? 'destructive' : 'secondary'} className="shrink-0 uppercase text-[10px]">
                        {g.sample.level}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.sample.message}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {g.count}× · {g.users.size} user{g.users.size === 1 ? '' : 's'}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pb-3 text-xs">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                      <span>Release <strong>{g.sample.release}</strong></span>
                      <span>Env {g.sample.environment}</span>
                      <span>Kind {g.sample.kind}</span>
                      <span>Last seen {formatDistanceToNow(new Date(g.last), { addSuffix: true })}</span>
                    </div>
                    {g.sample.url && <p className="break-all text-muted-foreground">URL: {g.sample.url}</p>}
                    {g.sample.user_agent && <p className="break-all text-muted-foreground">UA: {g.sample.user_agent}</p>}
                    {(g.sample.stack || g.sample.component_stack) && (
                      <pre className="max-h-52 overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-2 font-mono text-[11px] leading-relaxed">
                        {g.sample.stack || g.sample.component_stack}
                      </pre>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
