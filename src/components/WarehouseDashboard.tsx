import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWarehouseInventory, type InventoryItem } from '@/hooks/useWarehouseInventory';
import { useRequirements, type StockRequirement } from '@/hooks/useRequirements';
import {
  Warehouse,
  AlertTriangle,
  Package,
  Truck,
  CheckCircle2,
  PackageCheck,
  Clock,
  Plus,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Layers,
  Store,
} from 'lucide-react';
import { format } from 'date-fns';

export const WarehouseDashboard = () => {
  const {
    inventory,
    lowStockItems,
    hasReplenishmentAlert,
    loading: invLoading,
    adjustStock,
    setStockExact,
    addInventoryItem,
  } = useWarehouseInventory();

  const { requirements, loading: reqLoading } = useRequirements();

  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [exactQtyInput, setExactQtyInput] = useState<number>(0);
  const [thresholdInput, setThresholdInput] = useState<number>(5);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newSize, setNewSize] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newQty, setNewQty] = useState(20);
  const [newThreshold, setNewThreshold] = useState(5);

  // Metrics from real requirements
  const pendingRequests = requirements.filter(r => r.status === 'requested');
  const packedOrders = requirements.filter(r => r.status === 'packed');
  const inTransitMoved = requirements.filter(r => r.status === 'moved');
  const completedReceived = requirements.filter(r => r.status === 'received');

  const openAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    setExactQtyInput(item.on_hand);
    setThresholdInput(item.min_threshold);
    setAdjustModalOpen(true);
  };

  const handleSaveAdjustment = async () => {
    if (!selectedItem) return;
    await setStockExact(selectedItem.id, exactQtyInput, thresholdInput);
    setAdjustModalOpen(false);
    setSelectedItem(null);
  };

  const handleAddNewItem = async () => {
    if (!newSize.trim()) return;
    const ok = await addInventoryItem({
      size: newSize.trim(),
      category: newCategory.trim() || 'General',
      on_hand: Number(newQty),
      min_threshold: Number(newThreshold),
      location: 'Main Warehouse',
    });
    if (ok) {
      setNewSize('');
      setAddItemOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Replenishment Alert Banner */}
      {hasReplenishmentAlert && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="rounded-lg bg-destructive/20 p-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-destructive">
                  Replenishment Alert: {lowStockItems.length} Size{lowStockItems.length > 1 ? 's' : ''} Below Safety Threshold
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Critical sizes on hand are low. Prepare bulk reordering or manufacture immediately to avoid fulfillment delays.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lowStockItems.map(item => (
                    <Badge key={item.id} variant="outline" className="border-destructive/40 text-destructive bg-destructive/10 text-xs">
                      Size {item.size} ({item.on_hand} left / min {item.min_threshold})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="shrink-0"
              onClick={() => {
                if (lowStockItems[0]) openAdjust(lowStockItems[0]);
              }}
            >
              Restock Critical Items
            </Button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3.5 w-3.5 text-amber-500" /> Pending Requests
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{pendingRequests.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-[11px] text-muted-foreground">Awaiting packing from shops</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <PackageCheck className="h-3.5 w-3.5 text-blue-500" /> Packed & Staged
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{packedOrders.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-[11px] text-muted-foreground">Ready for vehicle dispatch</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Truck className="h-3.5 w-3.5 text-violet-500" /> In Transit (Moved)
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{inTransitMoved.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-[11px] text-muted-foreground">En route to branch shops</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-1">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Completed Received
            </CardDescription>
            <CardTitle className="text-2xl font-bold">{completedReceived.length}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <span className="text-[11px] text-muted-foreground">Successfully delivered</span>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Inventory Management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Warehouse className="h-5 w-5 text-primary" /> Warehouse Inventory & Safety Thresholds
              </CardTitle>
              <CardDescription>
                Track live on-hand quantities, safety stock levels, and replenishment alerts across all sizes.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAddItemOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" /> Add Size / Item
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Size</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                  <TableHead className="text-right">Safety Threshold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Quick Adjust</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => {
                  const isLow = item.on_hand <= item.min_threshold;
                  const isOut = item.on_hand <= 0;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold text-sm">{item.size}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        <span className={isOut ? 'text-destructive font-bold' : isLow ? 'text-amber-600 font-semibold' : ''}>
                          {item.on_hand} pcs
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.min_threshold} pcs
                      </TableCell>
                      <TableCell>
                        {isOut ? (
                          <Badge variant="destructive">Out of stock</Badge>
                        ) : isLow ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300" variant="secondary">
                            Low stock
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" variant="secondary">
                            Healthy
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => adjustStock(item.id, 1)}
                            title="Add 1"
                          >
                            +1
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => adjustStock(item.id, -1)}
                            disabled={item.on_hand <= 0}
                            title="Deduct 1"
                          >
                            -1
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => openAdjust(item)}
                          >
                            Adjust
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Live Warehouse Movement & Fulfillment Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" /> Live Warehouse Movement & Fulfillment Activity
          </CardTitle>
          <CardDescription>
            Real orders connected from shop requests with pack and move audit logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[320px]">
            {requirements.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No orders logged yet.</p>
            ) : (
              <div className="space-y-3">
                {requirements.slice(0, 10).map((req) => (
                  <div key={req.id} className="rounded-lg border p-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Size {req.size} × {req.quantity}</span>
                        <Badge variant="secondary" className="capitalize">{req.status}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Store className="h-3 w-3" /> {req.shop_name || 'Shop'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Requested by {req.requested_by_name || 'Staff'} on {format(new Date(req.created_at), 'dd MMM HH:mm')}
                        {req.packed_by_name && ` · Packed by ${req.packed_by_name} (${format(new Date(req.packed_at!), 'HH:mm')})`}
                        {req.moved_by_name && ` · Moved by ${req.moved_by_name} (${format(new Date(req.moved_at!), 'HH:mm')})`}
                        {req.received_by_name && ` · Received by ${req.received_by_name}`}
                      </p>
                    </div>
                    {req.note && (
                      <span className="text-xs bg-muted px-2 py-1 rounded max-w-xs truncate text-muted-foreground">
                        Note: {req.note}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Adjust Inventory Modal */}
      <Dialog open={adjustModalOpen} onOpenChange={setAdjustModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock for Size {selectedItem?.size}</DialogTitle>
            <DialogDescription>
              Category: {selectedItem?.category} · Current: {selectedItem?.on_hand} pcs
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Exact On-Hand Quantity</Label>
              <Input
                type="number"
                min={0}
                value={exactQtyInput}
                onChange={e => setExactQtyInput(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Safety Replenishment Threshold (Alert below this)</Label>
              <Input
                type="number"
                min={0}
                value={thresholdInput}
                onChange={e => setThresholdInput(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAdjustModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAdjustment}>Save Inventory</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Item Modal */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Warehouse Stock Item</DialogTitle>
            <DialogDescription>Define a new size and initial safety threshold for warehouse tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Size (e.g. 46, XXL, 10 UK)</Label>
              <Input
                placeholder="e.g. 46"
                value={newSize}
                onChange={e => setNewSize(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                placeholder="General / Footwear / Apparel"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starting Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={newQty}
                  onChange={e => setNewQty(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Min Threshold</Label>
                <Input
                  type="number"
                  min={0}
                  value={newThreshold}
                  onChange={e => setNewThreshold(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancel</Button>
              <Button onClick={handleAddNewItem}>Add Item</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
