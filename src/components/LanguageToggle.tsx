import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { LANGUAGES, useTranslation } from '@/i18n';

export const LanguageToggle = () => {
  const { lang, setLang, t } = useTranslation();
  const current = LANGUAGES.find(l => l.code === lang);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 px-2" aria-label={t('nav.language')}>
          <Languages className="h-4 w-4" />
          <span className="hidden sm:inline text-xs font-medium">{current?.native}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 bg-popover">
        {LANGUAGES.map(l => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={l.code === lang ? 'font-semibold text-primary' : ''}
          >
            {l.native}
            <span className="ml-2 text-xs text-muted-foreground">{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
