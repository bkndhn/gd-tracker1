import { useExportJobs } from '@/hooks/useExportJobs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Download, X, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

export const ExportJobsPanel = () => {
  const { jobs, dismissJob, clearFinished } = useExportJobs();
  if (jobs.length === 0) return null;

  const active = jobs.filter(j => j.status === 'running' || j.status === 'queued').length;

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] space-y-2 md:bottom-6">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-muted-foreground">
          Exports {active > 0 && `(${active} running)`}
        </p>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={clearFinished}>
          Clear
        </Button>
      </div>

      {jobs.map(job => (
        <Card key={job.id} className="p-3 shadow-lg border-primary/20 bg-card/95 backdrop-blur">
          <div className="flex items-start gap-2">
            <div className="mt-0.5">
              {job.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-primary" />}
              {job.status === 'failed' && <AlertCircle className="h-4 w-4 text-destructive" />}
              {(job.status === 'running' || job.status === 'queued') && (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{job.label}</p>
              <p className="text-xs text-muted-foreground truncate">
                {job.error || job.message || 'Working…'}
              </p>
              {(job.status === 'running' || job.status === 'queued') && (
                <Progress value={job.progress} className="h-1.5 mt-2" />
              )}
              {job.status === 'completed' && (job.downloadUrl || job.openAction) && (
                <div className="mt-2">
                  {job.downloadUrl ? (
                    <Button asChild size="sm" className="h-7 gap-1 text-xs">
                      <a href={job.downloadUrl} download={job.fileName || 'export'}>
                        <Download className="h-3 w-3" /> Download
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" className="h-7 gap-1 text-xs" onClick={job.openAction}>
                      <ExternalLink className="h-3 w-3" /> Open
                    </Button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => dismissJob(job.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss export job"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
};
