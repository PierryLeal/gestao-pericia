'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function OptionCombobox({
  options,
  value,
  onChange,
  onClear,
  placeholder,
}: {
  options: { id: number; nome: string }[];
  value: number | null;
  onChange: (id: number) => void;
  onClear?: () => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  const clearable = Boolean(selected && onClear);

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={(
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-label={placeholder}
              className={cn('w-full justify-between', clearable && 'pr-8')}
            />
          )}
        >
          <span className="truncate">{selected ? selected.nome : placeholder}</span>
          {clearable ? <span className="ml-2 h-4 w-4 shrink-0" /> : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.nome}
                    onSelect={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === option.id ? 'opacity-100' : 'opacity-0')} />
                    {option.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clearable ? (
        <button
          type="button"
          aria-label={`Limpar filtro de ${placeholder.toLowerCase()}`}
          className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer text-muted-foreground opacity-50 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onClear?.();
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
