import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Cloud, Loader2, CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { formatISTDateTime } from '@/lib/dateUtils';

interface BackupLog {
  id: string;
  status: string;
  filename: string | null;
  drive_file_id: string | null;
  drive_web_link: string | null;
  size_bytes: number | null;
  took_ms: number | null;
  trigger_source: string;
  error_message: string | null;
  created_at: string;
}

const DRIVE_URL = 'https://drive.google.com/drive/recent';

export const GoogleDriveBackupPanel = () => {
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<BackupLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    const { data, error } = await (supabase.from('backup_logs') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    if (!error) setLogs((data || []) as BackupLog[]);
    setLoadingLogs(false);
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const runBackup = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-to-gdrive', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Backup uploaded to Google Drive');
    } catch (e: any) {
      toast.error(e?.message || 'Backup failed');
    } finally {
      setRunning(false);
      loadLogs();
    }
  };

  const fmt = (iso: string) => formatISTDateTime(iso);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Google Drive Backup
        </CardTitle>
        <CardDescription>
          Full JSON dump of all tenant data uploaded to Google Drive. Automatic backup runs daily at 11:55 PM IST.
          Images stay in Supabase storage buckets (already durable).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={runBackup} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
            {running ? 'Backing up...' : 'Backup Now'}
          </Button>
          <Button variant="outline" asChild>
            <a href={logs.find(l => l.drive_web_link)?.drive_web_link || DRIVE_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" /> Open Google Drive
            </a>
          </Button>
          <Button variant="ghost" size="icon" onClick={loadLogs} disabled={loadingLogs} aria-label="Refresh logs">
            <RefreshCw className={`h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Last 5 backups</h4>
          {loadingLogs && <div className="h-16 bg-muted rounded animate-pulse" />}
          {!loadingLogs && logs.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No backups recorded yet.</p>
          )}
          {logs.map(log => (
            <div key={log.id} className="flex items-start justify-between gap-3 p-3 border rounded-md text-sm">
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 font-medium">
                  {log.status === 'success'
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    : <XCircle className="h-4 w-4 text-destructive" />}
                  <span>{fmt(log.created_at)}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                    {log.trigger_source}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">{log.filename}</div>
                {log.status === 'success' ? (
                  <div className="text-xs text-muted-foreground">
                    {((log.size_bytes || 0) / 1024).toFixed(1)} KB · {log.took_ms} ms
                  </div>
                ) : (
                  <div className="text-xs text-destructive break-words">{log.error_message}</div>
                )}
              </div>
              {log.drive_web_link && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={log.drive_web_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
