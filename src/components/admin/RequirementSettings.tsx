import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ClipboardList } from 'lucide-react';
import { toast } from 'sonner';
import { useRequirementsAccess } from '@/hooks/useRequirementsAccess';

export const RequirementSettings = () => {
  const { visible, tenantEnabled, loading, save, canEdit } = useRequirementsAccess();

  const onToggle = async (next: boolean) => {
    try {
      await save(next, next ? 'Requirements tab shown' : 'Requirements tab hidden');
      toast.success(next ? 'Requirements tab is now visible' : 'Requirements tab hidden');
    } catch (e: any) {
      toast.error(e.message || 'Could not save this setting');
    }
  };

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4 text-primary" /> Stock requirements
        </CardTitle>
        <CardDescription>
          Let shop staff request sizes from the warehouse and track packed, moved and received steps.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!tenantEnabled ? (
          <p className="text-sm text-muted-foreground">
            This feature is switched off for your account. Ask your provider to enable it.
          </p>
        ) : (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label>Show the Requirements tab</Label>
              <p className="text-xs text-muted-foreground">Hiding it removes the tab for everyone in your account.</p>
            </div>
            <Switch checked={visible !== false} disabled={loading || !canEdit} onCheckedChange={onToggle} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
