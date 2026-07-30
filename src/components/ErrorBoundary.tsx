import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { captureException, APP_RELEASE } from '@/lib/errorTracking';

interface Props {
  children: React.ReactNode;
  /** Name of the area being guarded — shows up in the crash report */
  boundary?: string;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Catches render-phase crashes, reports them as `fatal` (marking the session
 * as crashed for release-health) and shows a recoverable fallback.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    void captureException(error, {
      level: 'fatal',
      kind: `react.${this.props.boundary || 'boundary'}`,
      componentStack: info.componentStack || undefined,
    });
  }

  private reset = () => this.setState({ hasError: false, message: undefined });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return <>{this.props.fallback}</>;

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            The issue has been reported automatically. You can retry this section or reload the app.
          </p>
          {this.state.message && (
            <p className="pt-1 font-mono text-xs text-muted-foreground/70">{this.state.message}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={this.reset} variant="default" size="sm" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline" size="sm">
            Reload app
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground/60">Release {APP_RELEASE}</p>
      </div>
    );
  }
}
