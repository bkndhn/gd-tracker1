import { useCallback, useEffect, useState } from 'react';

export type DashboardWidgetId =
  | 'kpi_today'
  | 'kpi_week'
  | 'kpi_month'
  | 'kpi_total'
  | 'charts'
  | 'ai'
  | 'by_shop'
  | 'by_category'
  | 'by_size'
  | 'by_customer_type';

export interface DashboardWidgetMeta {
  id: DashboardWidgetId;
  label: string;
  group: 'kpi' | 'section' | 'breakdown';
}

export const DASHBOARD_WIDGETS: DashboardWidgetMeta[] = [
  { id: 'kpi_today', label: 'Today', group: 'kpi' },
  { id: 'kpi_week', label: 'This Week', group: 'kpi' },
  { id: 'kpi_month', label: 'This Month', group: 'kpi' },
  { id: 'kpi_total', label: 'Total', group: 'kpi' },
  { id: 'charts', label: 'Analytics Charts', group: 'section' },
  { id: 'ai', label: 'AI Insights', group: 'section' },
  { id: 'by_shop', label: 'Breakdown: By Shop', group: 'breakdown' },
  { id: 'by_category', label: 'Breakdown: By Category', group: 'breakdown' },
  { id: 'by_size', label: 'Breakdown: By Size', group: 'breakdown' },
  { id: 'by_customer_type', label: 'Breakdown: By Customer Type', group: 'breakdown' },
];

export interface DashboardLayout {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
}

const DEFAULT_LAYOUT: DashboardLayout = {
  order: DASHBOARD_WIDGETS.map(w => w.id),
  hidden: [],
};

const STORAGE_KEY = 'gd_dashboard_layout_v1';

function normalize(layout: Partial<DashboardLayout> | null): DashboardLayout {
  const known = DASHBOARD_WIDGETS.map(w => w.id);
  const order = (layout?.order || []).filter(id => known.includes(id));
  known.forEach(id => { if (!order.includes(id)) order.push(id); });
  const hidden = (layout?.hidden || []).filter(id => known.includes(id));
  return { order, hidden };
}

function read(): DashboardLayout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    return normalize(JSON.parse(raw));
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<DashboardLayout>(read);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* ignore */ }
  }, [layout]);

  const isVisible = useCallback(
    (id: DashboardWidgetId) => !layout.hidden.includes(id),
    [layout.hidden],
  );

  const orderedVisible = useCallback(
    (group: DashboardWidgetMeta['group']) => {
      const ids = DASHBOARD_WIDGETS.filter(w => w.group === group).map(w => w.id);
      return layout.order.filter(id => ids.includes(id) && !layout.hidden.includes(id));
    },
    [layout],
  );

  const toggle = useCallback((id: DashboardWidgetId) => {
    setLayout(prev => ({
      ...prev,
      hidden: prev.hidden.includes(id)
        ? prev.hidden.filter(h => h !== id)
        : [...prev.hidden, id],
    }));
  }, []);

  const move = useCallback((id: DashboardWidgetId, direction: -1 | 1) => {
    setLayout(prev => {
      const meta = DASHBOARD_WIDGETS.find(w => w.id === id);
      if (!meta) return prev;
      // Only reorder within the same group so grids stay coherent
      const groupIds = prev.order.filter(
        oid => DASHBOARD_WIDGETS.find(w => w.id === oid)?.group === meta.group,
      );
      const pos = groupIds.indexOf(id);
      const target = pos + direction;
      if (pos < 0 || target < 0 || target >= groupIds.length) return prev;
      const swapWith = groupIds[target];
      const order = [...prev.order];
      const a = order.indexOf(id);
      const b = order.indexOf(swapWith);
      [order[a], order[b]] = [order[b], order[a]];
      return { ...prev, order };
    });
  }, []);

  const reset = useCallback(() => setLayout(DEFAULT_LAYOUT), []);

  return { layout, isVisible, orderedVisible, toggle, move, reset };
}
