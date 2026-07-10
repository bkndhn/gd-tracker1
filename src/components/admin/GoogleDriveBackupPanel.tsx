import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Cloud, Loader2, CheckCircle2 } from 'lucide-react';

export const GoogleDriveBackupPanel = () => {
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  const runBackup = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('backup-to-gdrive', { body: {} });
      if (error) throw error;
      setLastResult(data);
      toast.success(`Backup uploaded to Google Drive (${((data?.sizeBytes || 0) / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      toast.error(e?.message || 'Backup failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Google Drive Backup
        </CardTitle>
        <CardDescription>
          Full JSON dump of all tenant data uploaded to Google Drive. Automatic daily backup runs at 11 PM.
          Images stay in Supabase storage buckets (already durable).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={runBackup} disabled={running} className="w-full sm:w-auto">
          {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}
          {running ? 'Backing up...' : 'Backup Now'}
        </Button>
        {lastResult && (
          <div className="text-sm p-3 bg-muted rounded-md space-y-1">
            <div className="flex items-center gap-2 font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> Success
            </div>
            <div><span className="text-muted-foreground">File:</span> {lastResult.filename}</div>
            <div><span className="text-muted-foreground">Drive File ID:</span> {lastResult.driveFileId}</div>
            <div><span className="text-muted-foreground">Size:</span> {((lastResult.sizeBytes || 0) / 1024).toFixed(1)} KB</div>
            <div><span className="text-muted-foreground">Took:</span> {lastResult.tookMs} ms</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
