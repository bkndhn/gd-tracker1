import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useClientTheme, THEME_PALETTES } from '@/hooks/useClientTheme';
import { Palette, Check, Sparkles, Smartphone, Eye } from 'lucide-react';

export const ThemeSettings = () => {
  const { currentTheme, allPalettes, updateTheme, saving } = useClientTheme();

  return (
    <Card className="premium-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Palette className="h-5 w-5 text-primary" /> Client Brand Theme & Notification Bar Color
            </CardTitle>
            <CardDescription>
              Customize the primary theme color for your account. This color is isolated to your organization and automatically applies to all users and the mobile notification/status bar.
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

        {/* Palette Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {allPalettes.map((p) => {
            const isSelected = currentTheme === p.id;
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
                      Selected
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

        <p className="text-xs text-muted-foreground">
          Tip: Changing your theme color updates your dashboard, buttons, active menu states, charts, and synchronizes the browser address/notification bar on Android and iOS devices.
        </p>
      </CardContent>
    </Card>
  );
};
