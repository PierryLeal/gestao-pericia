'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { listEscritoriosDistintos } from '../actions';

export function EscritorioCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (escritorio: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listEscritoriosDistintos()
      .then((result) => {
        // A successful call that comes back empty is otherwise
        // indistinguishable from a thrown error that got swallowed — this
        // flags that specific case (query ran fine, RLS/role check passed,
        // but zero rows matched) instead of just silently showing nothing.
        if (result.length === 0) {
          console.warn('listEscritoriosDistintos() retornou uma lista vazia (sem erro).');
        }
        setOptions(result);
      })
      .catch((err) => {
        console.error('Falha ao carregar escritórios', err);
        setOptions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery
    ? options.filter((o) => o.toLowerCase().includes(trimmedQuery.toLowerCase()))
    : options;
  const exactMatch = options.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase());

  function handleSelect(escritorio: string) {
    onChange(escritorio);
    setQuery('');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button" variant="outline" role="combobox" aria-label="Escritório"
            className="w-full justify-between"
          />
        }
      >
        <span className="truncate">{value || 'Selecione um escritório'}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar ou digitar escritório..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Carregando...
                </span>
              ) : (
                'Nenhum escritório encontrado.'
              )}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((escritorio) => (
                <CommandItem key={escritorio} value={escritorio} onSelect={() => handleSelect(escritorio)}>
                  <Check className={cn('mr-2 h-4 w-4', value === escritorio ? 'opacity-100' : 'opacity-0')} />
                  {escritorio}
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
