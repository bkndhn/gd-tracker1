import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Warehouse, AlertTriangle, ClipboardList } from 'lucide-react';
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

  const scrollToSection = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card className="premium-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-primary" /> Stock Requirements & Warehouse Settings
          </CardTitle>
          <CardDescription>
            Enable requirement requests and warehouse fulfillment tracking across your organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!tenantEnabled ? (
            <p className="text-sm text-muted-foreground">
              This feature is switched off for your account. Ask your provider to enable it.
            </p>
          ) : (
            <div className="flex items-center justify-between rounded-md border p-4 bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label className="font-medium">Show Requirements Tab</Label>
                  <Badge variant={visible !== false ? 'default' : 'outline'} className="text-xs">
                    {visible !== false ? 'Enabled' : 'Hidden'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  When enabled, shop staff can raise size requirements, and warehouse staff can fulfill them.
                </p>
              </div>
              <Switch checked={visible !== false} disabled={loading || !canEdit} onCheckedChange={onToggle} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
