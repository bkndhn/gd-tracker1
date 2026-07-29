import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  label: string;
  kind: 'excel' | 'pdf';
  status: ExportJobStatus;
  progress: number;
  message?: string;
  error?: string;
  /** Object URL for the finished file (Excel/CSV style downloads) */
  downloadUrl?: string;
  fileName?: string;
  /** Alternative finish action (e.g. re-open the print dialog for PDF) */
  openAction?: () => void;
  startedAt: number;
  finishedAt?: number;
}

export interface JobRunContext {
  setProgress: (pct: number, message?: string) => void;
  /** Yields to the browser so the progress UI can paint during heavy work */
  tick: () => Promise<void>;
}

export interface JobResult {
  blob?: Blob;
  fileName?: string;
  openAction?: () => void;
  message?: string;
}

interface ExportJobsValue {
  jobs: ExportJob[];
  startJob: (
    label: string,
    kind: ExportJob['kind'],
    run: (ctx: JobRunContext) => Promise<JobResult | void>,
  ) => string;
  dismissJob: (id: string) => void;
  clearFinished: () => void;
}

const ExportJobsContext = createContext<ExportJobsValue | null>(null);

export const ExportJobsProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const urls = useRef<Record<string, string>>({});

  const patch = useCallback((id: string, changes: Partial<ExportJob>) => {
    setJobs(prev => prev.map(j => (j.id === id ? { ...j, ...changes } : j)));
  }, []);

  const startJob: ExportJobsValue['startJob'] = useCallback((label, kind, run) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setJobs(prev => [
      { id, label, kind, status: 'queued' as ExportJobStatus, progress: 0, startedAt: Date.now() },
      ...prev,
    ].slice(0, 8));

    const ctx: JobRunContext = {
      setProgress: (pct, message) =>
        patch(id, { progress: Math.max(0, Math.min(100, Math.round(pct))), message, status: 'running' }),
      tick: () => new Promise<void>(resolve => setTimeout(resolve, 0)),
    };

    // Run outside the current render/click frame so the UI can paint immediately
    setTimeout(async () => {
      patch(id, { status: 'running', progress: 2, message: 'Preparing…' });
      try {
        const result = (await run(ctx)) || {};
        let downloadUrl: string | undefined;
        if (result.blob) {
          downloadUrl = URL.createObjectURL(result.blob);
          urls.current[id] = downloadUrl;
        }
        patch(id, {
          status: 'completed',
          progress: 100,
          message: result.message || 'Ready',
          downloadUrl,
          fileName: result.fileName,
          openAction: result.openAction,
          finishedAt: Date.now(),
        });
      } catch (e: any) {
        patch(id, {
          status: 'failed',
          error: e?.message || 'Export failed',
          finishedAt: Date.now(),
        });
      }
    }, 0);

    return id;
  }, [patch]);

  const dismissJob = useCallback((id: string) => {
    const url = urls.current[id];
    if (url) {
      URL.revokeObjectURL(url);
      delete urls.current[id];
    }
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setJobs(prev => {
      prev.forEach(j => {
        if (j.status === 'completed' || j.status === 'failed') {
          const url = urls.current[j.id];
          if (url) {
            URL.revokeObjectURL(url);
            delete urls.current[j.id];
          }
        }
      });
      return prev.filter(j => j.status === 'queued' || j.status === 'running');
    });
  }, []);

  return (
    <ExportJobsContext.Provider value={{ jobs, startJob, dismissJob, clearFinished }}>
      {children}
    </ExportJobsContext.Provider>
  );
};

export const useExportJobs = () => {
  const ctx = useContext(ExportJobsContext);
  if (!ctx) throw new Error('useExportJobs must be used within ExportJobsProvider');
  return ctx;
};
