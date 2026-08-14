'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listContratosDistintos } from '@/features/pericias/actions';

export function ContratoFiltro({
  value,
  onChange,
  id = 'contrato-filtro',
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}) {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    listContratosDistintos()
      .then(setOptions)
      .catch(() => setOptions([]));
  }, []);

  const items = { all: 'Todos os contratos', ...Object.fromEntries(options.map((o) => [o, o])) };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Contrato</Label>
      <Select items={items} value={value || 'all'} onValueChange={(v) => onChange(!v || v === 'all' ? '' : v)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Contrato" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os contratos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
