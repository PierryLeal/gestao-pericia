'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { listContratosDistintos } from '../actions';

export function ContratoCombobox({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (contrato: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    listContratosDistintos()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? options.filter((o) => o.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : options;
  const exactMatch = options.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase());

  function handleSelect(contrato: string) {
    onChange(contrato);
    setQuery('');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button" variant="outline" role="combobox" aria-label="Contrato"
            className="w-full justify-between"
          />
        }
      >
        <span className="truncate">{value || 'Selecione um contrato'}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar ou digitar contrato..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>Nenhum contrato encontrado.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__limpar__"
                  onSelect={() => {
                    onChange(null);
                    setQuery('');
                    setOpen(false);
                  }}
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Sem contrato
                </CommandItem>
              )}
              {filtered.map((contrato) => (
                <CommandItem key={contrato} value={contrato} onSelect={() => handleSelect(contrato)}>
                  <Check className={cn('mr-2 h-4 w-4', value === contrato ? 'opacity-100' : 'opacity-0')} />
                  {contrato}
                </CommandItem>
              ))}
              {trimmedQuery && !exactMatch && (
                <CommandItem value={trimmedQuery} onSelect={() => handleSelect(trimmedQuery)}>
                  Usar &quot;{trimmedQuery}&quot;
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
