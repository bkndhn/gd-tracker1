import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ThemedSearchInput } from '@/components/ThemedSearchInput';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatISTDateTime } from '@/lib/dateUtils';
import { Search, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

interface AuditLog {
  id: string;
  user_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: any;
  created_at: string;
}

export const AuditLogViewer = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = ((supabase as any).from('audit_logs'))
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }
      if (searchQuery) {
        query = query.ilike('user_email', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      if (import.meta.env.DEV) console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page, pageSize, actionFilter, searchQuery]);

  const actionColors: Record<string, string> = {
    login: 'default',
    logout: 'secondary',
    signup: 'default',
    user_deleted: 'destructive',
    user_paused: 'destructive',
    user_activated: 'default',
    role_changed: 'secondary',
    entry_deleted: 'destructive',
    bulk_pause: 'destructive',
    bulk_activate: 'default',
    data_export: 'default',
    pii_unmask: 'secondary',
    screen_lock: 'secondary',
    screen_unlock: 'default',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Audit Logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <ThemedSearchInput
              placeholder="Search by email..."
              value={searchQuery}
              onValueChange={v => { setSearchQuery(v); setPage(0); }}
            />
          </div>
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All actions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="data_export">📥 Data Exports</SelectItem>
              <SelectItem value="pii_unmask">👁️ PII Unmasks</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="signup">Signup</SelectItem>
              <SelectItem value="user_created">User Created</SelectItem>
              <SelectItem value="user_deleted">User Deleted</SelectItem>
              <SelectItem value="user_paused">User Paused</SelectItem>
              <SelectItem value="user_activated">User Activated</SelectItem>
              <SelectItem value="role_changed">Role Changed</SelectItem>
              <SelectItem value="entry_created">Entry Created</SelectItem>
              <SelectItem value="entry_deleted">Entry Deleted</SelectItem>
              <SelectItem value="bulk_pause">Bulk Pause</SelectItem>
              <SelectItem value="bulk_activate">Bulk Activate</SelectItem>
              <SelectItem value="signup_toggle">Signup Toggle</SelectItem>
              <SelectItem value="settings_changed">Settings Changed</SelectItem>
              <SelectItem value="screen_lock">Screen Lock</SelectItem>
              <SelectItem value="screen_unlock">Screen Unlock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No audit logs found</TableCell></TableRow>
              ) : logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs whitespace-nowrap">{formatISTDateTime(log.created_at)}</TableCell>
                  <TableCell className="text-sm">{log.user_email || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={(actionColors[log.action] as any) || 'outline'} className="text-xs">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.target_type && <span>{log.target_type}{log.target_id ? `: ${log.target_id.slice(0, 8)}...` : ''}</span>}
                  </TableCell>
                  <TableCell className="text-xs max-w-[280px]">
                    {log.action === 'data_export' && log.details ? (
                      <span className="font-medium text-foreground">
                        📥 {String(log.details.format || 'export').toUpperCase()} · {log.details.count ?? '?'} rows
                        {log.details.scope ? ` (${log.details.scope})` : ''}
                      </span>
                    ) : log.action === 'pii_unmask' && log.details ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        👁️ Unmasked phone ending in ..{log.details.phone_suffix || ''} ({log.details.context || 'view'})
                      </span>
                    ) : log.details && Object.keys(log.details).length > 0 ? (
                      <span className="truncate block max-w-[240px] text-muted-foreground">{JSON.stringify(log.details)}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows:</span>
            <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setPage(0); }}>
              <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1}</span>
            <Button variant="outline" size="sm" disabled={logs.length < pageSize} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
