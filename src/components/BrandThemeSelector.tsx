import React from 'react';
import { Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useClientTheme } from '@/hooks/useClientTheme';

export const BrandThemeSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { currentTheme, overallTheme, allPalettes, updateTheme } = useClientTheme();
  const activePalette = allPalettes.find((p) => p.id === currentTheme) || allPalettes[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          className={compact ? 'h-9 w-9 rounded-xl border-border/70 p-0 relative shrink-0' : 'h-9 gap-2 rounded-xl border-border/70 px-2.5 text-xs font-medium shrink-0'}
          aria-label="Change brand theme"
          title={`Brand Theme: ${activePalette?.name || 'Vibrant Purple'}`}
        >
          <div
            className="h-3 w-3 rounded-full ring-2 ring-background shrink-0 shadow-xs"
            style={{ backgroundColor: activePalette?.hex }}
          />
          {!compact && (
            <span className="hidden xl:inline text-xs font-medium max-w-[90px] truncate">
              {activePalette?.name}
            </span>
          )}
          <Palette className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-xl z-50">
        <DropdownMenuLabel className="text-xs font-semibold px-2 py-1.5 flex items-center justify-between">
          <span>Brand Theme</span>
          <span className="text-[10px] font-mono text-muted-foreground">{activePalette?.hex}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {allPalettes.map((pal) => {
            const isSelected = currentTheme === pal.id || overallTheme === pal.id;
            return (
              <DropdownMenuItem
                key={pal.id}
                onClick={() => updateTheme(pal.id)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                  isSelected ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-3.5 w-3.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10 dark:ring-white/20"
                    style={{ backgroundColor: pal.hex }}
                  />
                  <span className="truncate">{pal.name}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 stroke-[2.5]" />}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
