import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';
import { DASHBOARD_WIDGETS, type DashboardWidgetId, type useDashboardLayout } from '@/hooks/useDashboardLayout';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controller: ReturnType<typeof useDashboardLayout>;
}

const GROUP_LABEL: Record<string, string> = {
  kpi: 'Summary cards',
  section: 'Widgets',
  breakdown: 'Breakdown cards',
};

export const DashboardLayoutEditor = ({ open, onOpenChange, controller }: Props) => {
  const { layout, isVisible, toggle, move, reset } = controller;

  const groups: Array<'kpi' | 'section' | 'breakdown'> = ['kpi', 'section', 'breakdown'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
          <DialogDescription>
            Reorder, show or hide summary cards and widgets. Saved on this device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {groups.map(group => {
            const ids = layout.order.filter(
              id => DASHBOARD_WIDGETS.find(w => w.id === id)?.group === group,
            );
            return (
              <div key={group} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {GROUP_LABEL[group]}
                </p>
                {ids.map((id, idx) => {
                  const meta = DASHBOARD_WIDGETS.find(w => w.id === id)!;
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <Button
                          variant="ghost" size="icon" className="h-5 w-5"
                          disabled={idx === 0}
                          onClick={() => move(id as DashboardWidgetId, -1)}
                          aria-label={`Move ${meta.label} up`}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-5 w-5"
                          disabled={idx === ids.length - 1}
                          onClick={() => move(id as DashboardWidgetId, 1)}
                          aria-label={`Move ${meta.label} down`}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="flex-1 text-sm font-medium">{meta.label}</span>
                      <Switch
                        checked={isVisible(id as DashboardWidgetId)}
                        onCheckedChange={() => toggle(id as DashboardWidgetId)}
                        aria-label={`Toggle ${meta.label}`}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset to default
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
