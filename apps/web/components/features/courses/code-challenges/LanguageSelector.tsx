'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface Language {
  id: number;
  name: string;
}

// Popular languages for quick access
const POPULAR_LANGUAGE_IDS = new Set([
  71, // Python (3.8.1)
  63, // JavaScript (Node.js)
  74, // TypeScript
  62, // Java
  54, // C++
  50, // C
  73, // Rust
  60, // Go
]);

interface LanguageSelectorProps {
  languages: Language[];
  selectedId: number | null;
  onSelect: (languageId: number) => void;
  allowedLanguages?: number[];
  disabled?: boolean;
  className?: string;
}

export function LanguageSelector({
  languages,
  selectedId,
  onSelect,
  allowedLanguages,
  disabled = false,
  className,
}: LanguageSelectorProps) {
  const t = useTranslations('Activities.CodeChallenges');

  // Filter languages if allowedLanguages is specified
  const availableLanguages = useMemo(() => {
    if (!allowedLanguages || allowedLanguages.length === 0) {
      return languages;
    }
    return languages.filter((lang) => allowedLanguages.includes(lang.id));
  }, [languages, allowedLanguages]);

  // Group languages: popular first, then rest alphabetically
  const { popular, other } = useMemo(() => {
    const pop: Language[] = [];
    const oth: Language[] = [];

    for (const lang of availableLanguages) {
      if (POPULAR_LANGUAGE_IDS.has(lang.id)) {
        pop.push(lang);
      } else {
        oth.push(lang);
      }
    }

    // Sort each group by name
    pop.sort((a, b) => a.name.localeCompare(b.name));
    oth.sort((a, b) => a.name.localeCompare(b.name));

    return { popular: pop, other: oth };
  }, [availableLanguages]);

  const selectedLanguage = useMemo(
    () => availableLanguages.find((lang) => lang.id === selectedId),
    [availableLanguages, selectedId],
  );

  const handleSelect = useCallback(
    (value: string) => {
      const id = Number.parseInt(value, 10);
      if (!Number.isNaN(id)) {
        onSelect(id);
      }
    },
    [onSelect],
  );

  return (
    <Popover>
      <PopoverTrigger>
        <Button
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn('w-[200px] justify-between', className)}
        >
          {selectedLanguage?.name || t('selectLanguage')}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder={t('searchLanguage')} />
          <CommandList>
            <CommandEmpty>{t('noLanguageFound')}</CommandEmpty>
            {popular.length > 0 && (
              <CommandGroup heading={t('popularLanguages')}>
                {popular.map((lang) => (
                  <CommandItem
                    key={lang.id}
                    value={lang.id.toString()}
                    onSelect={handleSelect}
                  >
                    <Check className={cn('mr-2 h-4 w-4', selectedId === lang.id ? 'opacity-100' : 'opacity-0')} />
                    {lang.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {other.length > 0 && (
              <CommandGroup heading={t('otherLanguages')}>
                {other.map((lang) => (
                  <CommandItem
                    key={lang.id}
                    value={lang.id.toString()}
                    onSelect={handleSelect}
                  >
                    <Check className={cn('mr-2 h-4 w-4', selectedId === lang.id ? 'opacity-100' : 'opacity-0')} />
                    {lang.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Export a canonical list of Judge0 languages for consumers that expect it
export const JUDGE0_LANGUAGES: Language[] = [
  { id: 71, name: 'Python (3.8.1)' },
  { id: 63, name: 'JavaScript (Node.js)' },
  { id: 74, name: 'TypeScript' },
  { id: 62, name: 'Java' },
  { id: 54, name: 'C++' },
  { id: 50, name: 'C' },
  { id: 73, name: 'Rust' },
  { id: 60, name: 'Go' },
];

export default LanguageSelector;
