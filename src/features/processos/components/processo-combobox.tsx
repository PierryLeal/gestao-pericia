'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { searchProcessos, type Processo } from '../actions';
import { NovoProcessoDialog } from './novo-processo-dialog';

export function ProcessoCombobox({
  value,
  selected,
  onChange,
}: {
  value: number | null;
  selected: Processo | null;
  onChange: (processo: Processo) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Processo[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchProcessos(query));
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button type="button" variant="outline" role="combobox" className="w-full justify-between" />}
        >
          {selected ? `${selected.numero} — ${selected.autor} x ${selected.reu}` : 'Selecione um processo'}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar processo..." value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{isPending ? 'Buscando...' : 'Nenhum processo encontrado.'}</CommandEmpty>
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
                    {processo.numero} — {processo.autor} x {processo.reu}
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
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Novo processo
              </Button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      <NovoProcessoDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={onChange} />
    </>
  );
}
