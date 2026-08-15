'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { rotuloNumeroProcesso } from '@/lib/processo-numero-provisorio';
import { searchProcessos, type Processo } from '../actions';

export function ProcessoCombobox({
  value,
  selected,
  onChange,
  onNovoProcesso,
}: {
  value: number | null;
  selected: Processo | null;
  onChange: (processo: Processo) => void;
  // The caller decides how "criar novo processo" is presented — e.g. a form
  // already inside a dialog swaps its own content instead of stacking a
  // second dialog on top (see PericiaForm).
  onNovoProcesso: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Processo[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        try {
          setResults(await searchProcessos(query));
        } catch {
          setResults([]);
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" role="combobox" className="w-full justify-between" />}
      >
        <span
          className="min-w-0 flex-1 truncate text-left"
          title={selected ? `${rotuloNumeroProcesso(selected.numero)} — ${selected.autor} x ${selected.reu}` : undefined}
        >
          {selected ? `${rotuloNumeroProcesso(selected.numero)} — ${selected.autor} x ${selected.reu}` : 'Selecione um processo'}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar processo..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Buscando...
                </span>
              ) : (
                'Nenhum processo encontrado.'
              )}
            </CommandEmpty>
            <CommandGroup>
              {results.map((processo) => (
                <CommandItem
                  key={processo.id}
                  value={String(processo.id)}
                  onSelect={() => {
                    onChange(processo);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === processo.id ? 'opacity-100' : 'opacity-0')} />
                  {rotuloNumeroProcesso(processo.numero)} — {processo.autor} x {processo.reu}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                onNovoProcesso();
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Novo processo
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
