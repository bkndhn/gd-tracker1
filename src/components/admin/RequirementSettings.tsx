import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ClipboardList,
  Warehouse,
  UserCheck,
  PackageCheck,
  Truck,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Info
} from 'lucide-react';
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

      {/* Warehouse Staff Guide & Workflow Card */}
      <Card className="premium-card border-primary/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Warehouse className="h-5 w-5 text-primary" />
                Warehouse Staff Setup & Fulfillment Workflow Guide
              </CardTitle>
              <CardDescription>
                Step-by-step instructions for setting up warehouse personnel and fulfilling stock requests.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit">Operational Guide</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: User creation */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 space-y-2.5 bg-background hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-primary" /> Create Warehouse Staff
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                In <strong>User Management</strong> above, click <strong>Create User</strong> and set the Role to <code className="text-primary font-mono text-[11px] bg-muted px-1 py-0.5 rounded">Warehouse staff</code>. You can grant access to <strong>all shops</strong> or specific shops only.
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2.5 bg-background hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-primary" /> Shop Raises Request
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Shop staff open <strong>Requirements / Stock</strong> (default tab is <strong>Raise</strong>), select the desired size, category, urgency, and optional custom fields, then submit.
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2.5 bg-background hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <PackageCheck className="h-4 w-4 text-primary" /> Pack & Auto-Deduct
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Warehouse staff view pending orders in the Queue. Marking an order <strong>Packed</strong> captures the packer name, timestamp, notes, and <strong>automatically deducts inventory</strong>.
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2.5 bg-background hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <Truck className="h-4 w-4 text-primary" /> Move & Dispatch
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                When items are handed to transit or loaded, click <strong>Mark Moved</strong>. Enter courier tracking or driver info to keep shop staff informed of in-transit inventory.
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2.5 bg-background hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  5
                </div>
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Shop Confirms Receipt
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Once the parcel arrives at the shop, shop staff clicks <strong>Mark Received</strong>. The request lifecycle completes with full timestamp and actor signatures.
              </p>
            </div>

            <div className="border rounded-lg p-4 space-y-2.5 bg-background hover:border-primary/40 transition-colors">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  6
                </div>
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-primary" /> Reports & Audit Log
                </h4>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                View <strong>Requirements Report</strong> under the <strong>Reports</strong> page to analyze fulfillment times, grouped by shop and size, with one-click Excel and PDF export.
              </p>
            </div>
          </div>

          {/* Key Features Banner */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Warehouse Dashboard & Replenishment Alerts
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Safety Stock Thresholds:</strong> The Warehouse Inventory tab alerts you in real time when any size falls below its minimum safety stock level.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Custom Fields Flexibility:</strong> Add requirement-specific fields (e.g., Fabric type, Urgency reason) or reuse visit fields using Custom Fields Management.
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
