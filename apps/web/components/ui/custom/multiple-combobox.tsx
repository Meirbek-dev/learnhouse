'use client';

import { useId, useState } from 'react';

import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react';

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ComboboxMultipleProps<T> {
  items: T[];
  valueKey: keyof T;
  labelKey: keyof T;
  value?: T[keyof T][];
  defaultValue?: T[keyof T][];
  onChange?: (values: T[keyof T][]) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

function ComboboxMultiple<T extends Record<string, unknown>>({
  items,
  valueKey,
  labelKey,
  value,
  defaultValue = [],
  onChange,
  label,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  className,
}: ComboboxMultipleProps<T>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<T[keyof T][]>(defaultValue);

  const selectedValues = value ?? internalValue;

  const toggleSelection = (itemValue: T[keyof T]) => {
    const newValues = selectedValues.includes(itemValue)
      ? selectedValues.filter((v) => v !== itemValue)
      : [...selectedValues, itemValue];

    if (value === undefined) {
      setInternalValue(newValues);
    }
    onChange?.(newValues);
  };

  const removeSelection = (itemValue: T[keyof T]) => {
    const newValues = selectedValues.filter((v) => v !== itemValue);

    if (value === undefined) {
      setInternalValue(newValues);
    }
    onChange?.(newValues);
  };

  const getItemByValue = (val: T[keyof T]) => {
    return items.find((item) => item[valueKey] === val);
  };

  return (
    <div className={className ?? 'w-full max-w-xs space-y-2'}>
      {label && <Label htmlFor={id}>{label}</Label>}
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-auto min-h-18 w-full justify-between hover:bg-transparent"
            >
              <div className="flex flex-wrap items-center gap-1 pr-2">
                {selectedValues.length > 0 ? (
                  selectedValues.map((val) => {
                    const item = getItemByValue(val);

                    return item ? (
                      <Badge
                        key={String(val)}
                        variant="default"
                        className="h-fit w-fit rounded-sm "
                      >
                        {String(item[labelKey])}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSelection(val);
                          }}
                          render={
                            <span>
                              <XIcon className="size-4" />
                            </span>
                          }
                        />
                      </Badge>
                    ) : null;
                  })
                ) : (
                  <span className="text-muted-foreground">{placeholder}</span>
                )}
              </div>
              <ChevronsUpDownIcon
                className="text-muted-foreground/80 shrink-0"
                aria-hidden="true"
              />
            </Button>
          }
        />
        <PopoverContent className="w-(--radix-popper-anchor-width) p-0">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {items.map((item) => (
                  <CommandItem
                    key={String(item[valueKey])}
                    value={String(item[labelKey])}
                    onSelect={() => toggleSelection(item[valueKey])}
                  >
                    <span className="truncate">{String(item[labelKey])}</span>
                    {selectedValues.includes(item[valueKey]) && (
                      <CheckIcon
                        size={16}
                        className="ml-auto"
                      />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default ComboboxMultiple;
