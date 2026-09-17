import type { InsightEntry } from './lostSaleInsights';
import type { StockRequirement } from '@/hooks/useRequirements';
import type { SheetTable } from './insightExports';
import { formatISTDateTime, formatISTFileName } from './dateUtils';

export interface WarehouseInventoryItem {
  size: string;
  category?: string;
  on_hand: number;
  reorder_point?: number;
  updated_at?: string;
}

export interface PredictiveDemandItem {
  id: string; // `${category}___${size}`
  category: string;
  size: string;
  recentRequests: number;
  dailyVelocity: number;
  trendGrowthPct: number;
  currentOnHand: number;
  committedInQueue: number;
  availableStock: number;
  depletionRunwayDays: number;
  severity: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  recommendedReorderQty: number;
  estimatedRevenueAtRisk: number;
  conversionLikelihood: number;
}

export interface PredictiveSummary {
  criticalCount: number;
  warningCount: number;
  healthyCount: number;
  totalRevenueAtRisk: number;
  totalUnitsToReorder: number;
  topSpikeCategory: string;
  topSpikeSize: string;
}

export interface PredictiveDemandOptions {
  windowDays: number; // 7, 30, or 90
  supplierLeadTimeDays?: number; // default 5
  safetyStockDays?: number; // default 3
  avgItemPriceINR?: number; // default 1,500
}

export function computePredictiveDemand(
  entries: InsightEntry[],
  requirements: StockRequirement[] = [],
  inventory: WarehouseInventoryItem[] = [],
  options: PredictiveDemandOptions = { windowDays: 30 }
): { items: PredictiveDemandItem[]; summary: PredictiveSummary } {
  const windowDays = Math.max(1, options.windowDays || 30);
  const leadTime = options.supplierLeadTimeDays ?? 5;
  const safetyDays = options.safetyStockDays ?? 3;
  const avgPrice = options.avgItemPriceINR ?? 1500;

  const now = Date.now();
  const cutoffMs = now - windowDays * 86400000;
  const baselineCutoffMs = now - windowDays * 2 * 86400000;

  // 1. Group recent lost visits and previous baseline visits by Category + Size
  const currentCounts = new Map<string, { category: string; size: string; count: number }>();
  const baselineCounts = new Map<string, number>();

  entries.forEach((e) => {
    const time = new Date(e.created_at).getTime();
    const cat = e.categories?.name?.trim() || 'General';
    const sz = e.sizes?.size?.trim() || 'Standard';
    const key = `${cat}___${sz}`;

    if (time >= cutoffMs) {
      const existing = currentCounts.get(key) || { category: cat, size: sz, count: 0 };
      existing.count += 1;
      currentCounts.set(key, existing);
    } else if (time >= baselineCutoffMs) {
      baselineCounts.set(key, (baselineCounts.get(key) || 0) + 1);
    }
  });

  // 2. Also account for live counter requirements in the pipeline
  requirements.forEach((r) => {
    const time = new Date(r.created_at).getTime();
    if (time >= cutoffMs) {
      const cat = r.category?.trim() || 'General';
      const sz = r.size?.trim() || 'Standard';
      const key = `${cat}___${sz}`;
      const qty = r.quantity || 1;
      const existing = currentCounts.get(key) || { category: cat, size: sz, count: 0 };
      existing.count += qty;
      currentCounts.set(key, existing);
    }
  });

  // 3. Map warehouse on-hand levels and committed queue quantities
  const onHandMap = new Map<string, number>();
  inventory.forEach((inv) => {
    const sz = String(inv.size || '').trim().toLowerCase();
    const cat = (inv.category || '').trim().toLowerCase();
    const key = cat ? `${cat}___${sz}` : sz;
    onHandMap.set(key, (onHandMap.get(key) || 0) + (inv.on_hand || 0));
    if (cat) onHandMap.set(sz, (onHandMap.get(sz) || 0) + (inv.on_hand || 0));
  });

  const committedMap = new Map<string, number>();
  requirements.forEach((r) => {
    if (r.status === 'requested' || r.status === 'packed' || r.status === 'moved') {
      const sz = (r.size || '').trim().toLowerCase();
      const cat = (r.category || '').trim().toLowerCase();
      const key = cat ? `${cat}___${sz}` : sz;
      const q = r.quantity || 0;
      committedMap.set(key, (committedMap.get(key) || 0) + q);
      if (cat) committedMap.set(sz, (committedMap.get(sz) || 0) + q);
    }
  });

  // 4. Compute metrics per Category × Size pair
  const items: PredictiveDemandItem[] = [];

  currentCounts.forEach(({ category, size, count }, key) => {
    const normSz = size.trim().toLowerCase();
    const normCat = category.trim().toLowerCase();
    const fullKey = `${normCat}___${normSz}`;

    const onHand = onHandMap.get(fullKey) ?? onHandMap.get(normSz) ?? 0;
    const committed = committedMap.get(fullKey) ?? committedMap.get(normSz) ?? 0;
    const available = Math.max(0, onHand - committed);

    const dailyVelocity = count / windowDays;
    const prevCount = baselineCounts.get(key) || 0;
    const trendGrowthPct = prevCount > 0 ? Math.round(((count - prevCount) / prevCount) * 100) : 100;

    // Depletion Runway: Days of available inventory left under current velocity
    const depletionRunwayDays = dailyVelocity > 0 ? Math.max(0, Math.round((available / dailyVelocity) * 10) / 10) : 999;

    // Severity
    let severity: 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
    if (available === 0 || depletionRunwayDays <= 2) {
      severity = 'CRITICAL';
    } else if (depletionRunwayDays <= (leadTime + safetyDays)) {
      severity = 'WARNING';
    }

    // Recommended Re-Order Quantity
    // Demand over (LeadTime + SafetyDays) minus existing Available
    const targetBuffer = Math.ceil(dailyVelocity * (leadTime + safetyDays));
    const recommendedReorderQty = Math.max(0, targetBuffer - available);

    // Revenue at Risk
    const revenueAtRisk = count * avgPrice;

    // Conversion likelihood estimation (higher when trend is growing and size is popular)
    const conversionLikelihood = Math.min(95, Math.max(45, 50 + Math.round(dailyVelocity * 8) + (trendGrowthPct > 20 ? 10 : 0)));

    items.push({
      id: key,
      category,
      size,
      recentRequests: count,
      dailyVelocity: Math.round(dailyVelocity * 100) / 100,
      trendGrowthPct,
      currentOnHand: onHand,
      committedInQueue: committed,
      availableStock: available,
      depletionRunwayDays,
      severity,
      recommendedReorderQty,
      estimatedRevenueAtRisk: revenueAtRisk,
      conversionLikelihood,
    });
  });

  // Sort by priority: CRITICAL first, then WARNING, then by highest velocity
  items.sort((a, b) => {
    const score = (item: PredictiveDemandItem) =>
      (item.severity === 'CRITICAL' ? 1000 : item.severity === 'WARNING' ? 500 : 0) + item.dailyVelocity * 10;
    return score(b) - score(a);
  });

  // 5. Summary metrics
  const criticalItems = items.filter((i) => i.severity === 'CRITICAL');
  const warningItems = items.filter((i) => i.severity === 'WARNING');
  const healthyItems = items.filter((i) => i.severity === 'HEALTHY');

  const topSpike = items.length > 0 ? items[0] : null;

  const summary: PredictiveSummary = {
    criticalCount: criticalItems.length,
    warningCount: warningItems.length,
    healthyCount: healthyItems.length,
    totalRevenueAtRisk: items.reduce((acc, i) => acc + i.estimatedRevenueAtRisk, 0),
    totalUnitsToReorder: items.reduce((acc, i) => acc + i.recommendedReorderQty, 0),
    topSpikeCategory: topSpike?.category || '—',
    topSpikeSize: topSpike?.size || '—',
  };

  return { items, summary };
}

/**
 * Builds a universal SheetTable formatted for Purchase Orders (PO) to send to suppliers
 */
export function buildPurchaseOrderSheet(items: PredictiveDemandItem[], windowDays: number = 30): SheetTable {
  const filtered = items.filter((i) => i.recommendedReorderQty > 0);
  const nowStr = formatISTDateTime(new Date());

  return {
    title: 'Automated Supplier Purchase Order (PO) & Restock Sheet',
    subtitle: `Generated from ${windowDays}-day predictive demand velocity · IST: ${nowStr}`,
    columns: [
      'Category / Department',
      'Size / SKU',
      'Daily Velocity (units/day)',
      'Warehouse Available',
      'Depletion Runway (Days)',
      'Urgency Priority',
      'Recommended Order Qty',
      'Est. Conversion %',
      'Est. Revenue at Risk (INR)',
    ],
    rows: filtered.map((i) => [
      i.category,
      i.size,
      i.dailyVelocity.toFixed(2),
      i.availableStock,
      i.depletionRunwayDays <= 0 ? 'Stockout Now' : `${i.depletionRunwayDays} days`,
      i.severity,
      i.recommendedReorderQty,
      `${i.conversionLikelihood}%`,
      `₹${i.estimatedRevenueAtRisk.toLocaleString('en-IN')}`,
    ]),
    fileName: formatISTFileName(new Date(), 'predictive-purchase-order'),
  };
}
