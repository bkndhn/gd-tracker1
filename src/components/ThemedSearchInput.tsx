import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/AppLogo';

export interface ThemedSearchInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
  onValueChange?: (val: string) => void;
  onClear?: () => void;
  showInsignia?: boolean;
  shortcut?: string;
  containerClassName?: string;
}

export const ThemedSearchInput = React.forwardRef<HTMLInputElement, ThemedSearchInputProps>(
  (
    {
      value,
      onValueChange,
      onClear,
      onChange,
      showInsignia = true,
      shortcut,
      containerClassName,
      className,
      placeholder = 'Search...',
      ...props
    },
    ref
  ) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    const handleClear = () => {
      onValueChange?.('');
      onClear?.();
    };

    return (
      <div className={cn('relative flex items-center w-full group', containerClassName)}>
        {/* Left Search & Brand Insignia Cluster */}
        <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
          <Search className="h-4 w-4 shrink-0 transition-transform duration-200 group-focus-within:scale-110" />
          {showInsignia && (
            <div className="hidden sm:block opacity-60 group-focus-within:opacity-100 transition-opacity">
              <AppLogo variant="icon" pixelSize={14} />
            </div>
          )}
        </div>

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={cn(
            'w-full h-9 sm:h-10 pl-9 sm:pl-12 pr-9 sm:pr-10 rounded-lg text-sm bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border/80 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all outline-none text-foreground placeholder:text-muted-foreground/70',
            className
          )}
          {...props}
        />

        {/* Right actions: Clear button and keyboard shortcut */}
        <div className="absolute right-2.5 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {shortcut && !value && (
            <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/70 border border-border/60 rounded">
              {shortcut}
            </kbd>
          )}
        </div>
      </div>
    );
  }
);

ThemedSearchInput.displayName = 'ThemedSearchInput';
