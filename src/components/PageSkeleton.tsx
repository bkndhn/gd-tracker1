import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const DashboardSkeleton = () => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-7 w-48 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-32" />
          </Card>
        ))}
      </div>

      {/* Chart and Section Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </Card>
        <Card className="p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

export const RequirementsSkeleton = () => {
  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200">
      {/* Tabs list skeleton */}
      <div className="grid w-full grid-cols-2 gap-1 p-1 rounded-lg bg-muted/50 max-w-md">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-9 w-full rounded-md" />
      </div>

      {/* Main Form Card Skeleton */}
      <Card>
        <CardHeader className="space-y-2 pb-4">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
              <div className="flex gap-2 pt-1">
                {[1, 2, 3, 4, 5, 6].map(k => (
                  <Skeleton key={k} className="h-7 w-12 rounded-md" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-10 w-36 rounded-md" />
        </CardContent>
      </Card>
    </div>
  );
};

export const TableSkeleton = () => {
  return (
    <div className="space-y-4 animate-in fade-in-50 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Skeleton className="h-7 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-4 pb-2 border-b">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-border/40">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-16 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export const FormSkeleton = () => {
  return (
    <div className="space-y-4 max-w-xl mx-auto animate-in fade-in-50 duration-200">
      <Card className="p-6 space-y-4">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-11 w-full rounded-md" />
        </div>
      </Card>
    </div>
  );
};

export const PageSkeleton = ({ variant = 'dashboard' }: { variant?: 'dashboard' | 'requirements' | 'table' | 'form' }) => {
  switch (variant) {
    case 'requirements':
      return <RequirementsSkeleton />;
    case 'table':
      return <TableSkeleton />;
    case 'form':
      return <FormSkeleton />;
    case 'dashboard':
    default:
      return <DashboardSkeleton />;
  }
};
