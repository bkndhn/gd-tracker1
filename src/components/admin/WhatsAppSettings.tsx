import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export const WhatsAppSettings = () => {
  const { profile } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSetting();
  }, []);

  const fetchSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'whatsapp_redirect_enabled')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        const value = data.value as { enabled?: boolean };
        setEnabled(value.enabled ?? false);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching WhatsApp setting:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (newValue: boolean) => {
    try {
      setEnabled(newValue);
      
      const { error } = await (supabase
        .from('app_settings') as any)
        .upsert({
          key: 'whatsapp_redirect_enabled',
          value: { enabled: newValue },
          admin_id: (profile as any)?.admin_id || profile?.id,
        }, { onConflict: 'admin_id,key' });

      if (error) throw error;
      
      toast.success(`WhatsApp redirect ${newValue ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      setEnabled(!newValue); // Revert on error
      toast.error(error.message || 'Failed to update setting');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse h-16 bg-muted rounded"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-green-600" />
          WhatsApp Integration
        </CardTitle>
        <CardDescription>
          Redirect staff to their shop's WhatsApp group after submitting a GD report
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="whatsapp-toggle" className="text-base">
              Enable WhatsApp Redirect
            </Label>
            <p className="text-sm text-muted-foreground">
              Staff will be redirected to WhatsApp group after submission
            </p>
          </div>
          <Switch
            id="whatsapp-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardContent>
    </Card>
  );
};
