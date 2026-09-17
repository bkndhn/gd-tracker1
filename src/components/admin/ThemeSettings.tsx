import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useClientTheme, THEME_PALETTES, type RoleThemes } from '@/hooks/useClientTheme';
import { Palette, Check, Sparkles, Smartphone, Eye, Users, Shield, Store, Warehouse, RotateCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const ThemeSettings: React.FC = () => {
  const {
    currentTheme,
    overallTheme,
    roleThemes,
    allPalettes,
    updateTheme,
    updateRoleTheme,
    saving,
  } = useClientTheme();

  const [showRoleOverrides, setShowRoleOverrides] = useState(
    Object.keys(roleThemes || {}).length > 0
  );

  const roleConfigs = [
    {
      key: 'manager' as keyof RoleThemes,
      label: 'Shop Managers',
      description: 'Used by managers overseeing specific stores and team sales',
      icon: Store,
      defaultColor: overallTheme,
    },
    {
      key: 'warehouse' as keyof RoleThemes,
      label: 'Warehouse & Fulfillment',
      description: 'Used by logistics staff packing and moving stock requests',
      icon: Warehouse,
      defaultColor: overallTheme,
    },
    {
      key: 'user' as keyof RoleThemes,
      label: 'Sales Reps & Floor Staff',
      description: 'Used by field employees logging lost walk-ins and requests',
      icon: Users,
      defaultColor: overallTheme,
    },
  ];

  return (
    <Card className="premium-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Palette className="h-5 w-5 text-primary" /> Client Brand Theme & Notification Bar Color
            </CardTitle>
            <CardDescription>
              Customize the primary theme color for your organization. This color is cryptographically isolated to your account and automatically applies to all users and the mobile notification/status bar.
            </CardDescription>
          </div>
          <Badge variant="outline" className="w-fit text-xs font-mono border-primary/30 text-primary">
            Active: {THEME_PALETTES[currentTheme]?.name || currentTheme}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live Preview Card */}
        <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> Live Preview
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Mobile Notification Bar: <strong className="font-mono">{THEME_PALETTES[currentTheme]?.hex}</strong></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" className="shadow-xs gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Primary Action
            </Button>
            <Button variant="outline" size="sm" className="border-primary/40 text-primary hover:bg-primary/10">
              Secondary Action
            </Button>
            <Badge className="bg-primary/15 text-primary hover:bg-primary/20">
              Active Status Badge
            </Badge>
            <div className="h-4 w-4 rounded-full bg-primary shadow-xs ring-2 ring-primary/20" />
          </div>
        </div>

        {/* Overall Brand Palette Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Overall Brand Theme</h4>
              <p className="text-xs text-muted-foreground">The primary theme applied across your entire organization by default.</p>
            </div>
            <span className="text-xs font-mono text-muted-foreground">{allPalettes.length} palettes available</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {allPalettes.map((p) => {
              const isSelected = overallTheme === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={saving}
                  onClick={() => updateTheme(p.id)}
                  className={`relative p-3.5 rounded-xl border text-left transition-all group hover:shadow-md ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 bg-primary/5 shadow-xs'
                      : 'border-border/70 hover:border-primary/40 bg-card'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-7 w-7 rounded-lg shadow-xs flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: p.hex }}
                      >
                        {isSelected && <Check className="h-4 w-4 stroke-[3]" />}
                      </div>
                      <div>
                        <div className="text-sm font-semibold leading-none text-foreground">{p.name}</div>
                        <div className="text-[11px] font-mono text-muted-foreground mt-1">{p.hex}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5">
                        Brand
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Role-Isolated Themes Section */}
        <div className="p-4 rounded-xl border bg-card/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Role-Isolated Theme Accents (Optional)</h4>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assign distinct theme colors for different roles within your client account while keeping your overall brand theme.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRoleOverrides(!showRoleOverrides)}
              className="text-xs shrink-0"
            >
              {showRoleOverrides ? 'Hide Role Settings' : 'Customize Role Themes'}
            </Button>
          </div>

          {showRoleOverrides && (
            <div className="space-y-3 pt-2 border-t">
              {roleConfigs.map(({ key, label, description, icon: Icon }) => {
                const activeRoleTheme = roleThemes[key];
                const effectiveRoleHex = activeRoleTheme
                  ? THEME_PALETTES[activeRoleTheme]?.hex
                  : THEME_PALETTES[overallTheme]?.hex;

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0"
                        style={{ backgroundColor: effectiveRoleHex }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{label}</span>
                          {activeRoleTheme ? (
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              Custom: {THEME_PALETTES[activeRoleTheme]?.name}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Inherits Brand Theme
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <Select
                        value={activeRoleTheme || 'inherit'}
                        onValueChange={(val) => updateRoleTheme(key, val === 'inherit' ? null : val)}
                        disabled={saving}
                      >
                        <SelectTrigger className="w-[180px] h-8 text-xs">
                          <SelectValue placeholder="Select palette..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inherit">Inherit Brand Theme</SelectItem>
                          {allPalettes.map((pal) => (
                            <SelectItem key={pal.id} value={pal.id}>
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: pal.hex }} />
                                <span>{pal.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {activeRoleTheme && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateRoleTheme(key, null)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Reset to brand theme"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: Changing your theme color updates your dashboard, buttons, active menu states, charts, and synchronizes the browser address/notification bar on Android and iOS devices.
        </p>
      </CardContent>
    </Card>
  );
};
