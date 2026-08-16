'use client';

import { useEffect, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { listContratosDistintos } from '@/features/pericias/actions';

export { serializeContratos, parseContratos } from '@/lib/contratos';

export function ContratoFiltro({
  value,
  onChange,
  id = 'contrato-filtro',
}: {
  value: string[];
  onChange: (value: string[]) => void;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    listContratosDistintos()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  function alternar(contrato: string) {
    onChange(value.includes(contrato) ? value.filter((v) => v !== contrato) : [...value, contrato]);
  }

  const rotulo =
    value.length === 0 ? 'Todos os contratos' : value.length === 1 ? value[0] : `${value.length} contratos selecionados`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Contrato</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button id={id} type="button" variant="outline" role="combobox" className="w-full justify-between" />}
        >
          <span className="min-w-0 flex-1 truncate text-left">{rotulo}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0">
          <Command>
            <CommandInput placeholder="Buscar contrato..." />
            <CommandList>
              <CommandEmpty>Nenhum contrato encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const selecionado = value.includes(o);
                  return (
                    <CommandItem key={o} value={o} onSelect={() => alternar(o)}>
                      <Check className={cn('mr-2 h-4 w-4', selecionado ? 'opacity-100' : 'opacity-0')} />
                      {o}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
            {value.length > 0 && (
              <div className="border-t p-2">
                <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
                  Limpar seleção
                </Button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
