'use client';

import { useEffect, useState, useTransition } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { searchMunicipios, type MunicipioIBGE } from '@/lib/ibge/client';
import { upsertMunicipio } from '../actions';

export function MunicipioCombobox({
  value,
  selected,
  onChange,
}: {
  value: number | null;
  selected: MunicipioIBGE | null;
  onChange: (municipio: MunicipioIBGE) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MunicipioIBGE[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const handle = setTimeout(() => {
      startTransition(async () => {
        try {
          setResults(await searchMunicipios(query));
        } catch {
          setResults([]);
        }
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleSelect(municipio: MunicipioIBGE) {
    await upsertMunicipio(municipio);
    onChange(municipio);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button type="button" variant="outline" role="combobox" className="w-full justify-between" />}
      >
        {selected ? `${selected.nome}/${selected.uf}` : 'Selecione um município'}
        <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar município..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Buscando...
                </span>
              ) : (
                'Digite ao menos 2 letras.'
              )}
            </CommandEmpty>
            <CommandGroup>
              {results.map((municipio) => (
                <CommandItem
                  key={municipio.id}
                  value={String(municipio.id)}
                  onSelect={() => handleSelect(municipio)}
                >
                  <Check className={cn('mr-2 h-4 w-4', value === municipio.id ? 'opacity-100' : 'opacity-0')} />
                  {municipio.nome}/{municipio.uf}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
