import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Bell, X, Package, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useAnomalyAlerts, getDismissed } from '@/hooks/useAnomalyAlerts';
import { AnomalyAlertsPanel } from '@/components/AnomalyAlertsPanel';

interface Notification {
  id: string;
  message: string;
  shopName: string;
  categoryName: string;
  timestamp: Date;
  read: boolean;
}

export const NotificationBell = () => {
  const { isAdmin, isManager, userShopId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { alerts } = useAnomalyAlerts();
  const [dismissed, setDismissed] = useState<string[]>(() => getDismissed());
  useEffect(() => {
    const handler = () => setDismissed(getDismissed());
    window.addEventListener('anomaly-dismissed', handler);
    return () => window.removeEventListener('anomaly-dismissed', handler);
  }, []);
  const visibleAlerts = useMemo(
    () => alerts.filter(a => !dismissed.includes(a.id)),
    [alerts, dismissed],
  );

  const unreadCount = notifications.filter(n => !n.read).length + visibleAlerts.length;


  // Play notification sound
  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  // Subscribe to real-time visits
  useEffect(() => {
    if (!isAdmin && !isManager) return;

    const channelName = `notif_${userShopId || 'all'}_${Math.random().toString(36).substring(2, 9)}`;
    let channel: any = null;

    try {
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'goods_damaged_entries'
          },
          async (payload) => {
            if (import.meta.env.DEV) console.log('New lost sale notification:', payload);
            
            const newEntry = payload.new as any;
            
            // For managers, only show notifications for their shop
            if (isManager && userShopId && newEntry.shop_id !== userShopId) {
              return;
            }
            
            // Fetch related shop and category names
            const [shopRes, categoryRes] = await Promise.all([
              supabase.from('shops').select('name').eq('id', newEntry.shop_id).single(),
              supabase.from('categories').select('name').eq('id', newEntry.category_id).single()
            ]);
            
            const shopName = shopRes.data?.name || 'Unknown Shop';
            const categoryName = categoryRes.data?.name || 'Unknown Category';
            
            const notification: Notification = {
              id: newEntry.id,
              message: `New lost sale: ${categoryName}`,
              shopName,
              categoryName,
              timestamp: new Date(newEntry.created_at),
              read: false
            };
            
            setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
            playNotificationSound();
            
            // Show toast notification
            toast.info(`New lost sale from ${shopName}`, {
              description: categoryName,
              duration: 4000,
            });
          }
        )
        .subscribe();
    } catch (err) {
      if (import.meta.env.DEV) console.error('NotificationBell realtime error', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [isAdmin, isManager, userShopId]);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (!isAdmin && !isManager) return null;

  return (
    <>
      {/* Notification sound */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU..." type="audio/wav" />
      </audio>

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative"
            onClick={() => {
              setIsOpen(true);
              markAllAsRead();
            }}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          align="end" 
          className="w-80 p-0"
          sideOffset={8}
        >
          <div className="flex items-center justify-between p-3 border-b">
            <h4 className="font-semibold">Notifications</h4>
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </Button>
            )}
          </div>

          <Tabs defaultValue="activity">
            <TabsList className="grid grid-cols-2 w-full rounded-none bg-transparent border-b h-9">
              <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
              <TabsTrigger value="alerts" className="text-xs">
                Alerts{visibleAlerts.length > 0 ? ` (${visibleAlerts.length})` : ''}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="activity" className="m-0">
              <ScrollArea className="max-h-[300px]">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">No notifications yet</p>
                    <p className="text-xs">New lost sale entries will appear here</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-3 hover:bg-muted/50 transition-colors ${
                          !notification.read ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-full shrink-0">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {notification.shopName}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTime(notification.timestamp)}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotification(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="alerts" className="m-0">
              <AnomalyAlertsPanel alerts={visibleAlerts} />
            </TabsContent>
          </Tabs>
        </PopoverContent>

      </Popover>
    </>
  );
};