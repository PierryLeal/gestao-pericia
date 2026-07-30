'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { OptionCombobox } from '@/components/shared/option-combobox';
import { situacaoOptions } from '../schemas';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };

export function PericiasFilters({
  peritos,
  colaboradores,
}: {
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');

  useEffect(() => {
    if (busca === (searchParams.get('busca') ?? '')) return;
    const handle = setTimeout(() => updateParam('busca', busca), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/?${params.toString()}`);
  }

  const municipioId = searchParams.get('municipioId');
  const peritoId = searchParams.get('peritoId');
  const colaboradorId = searchParams.get('colaboradorId');

  function handleClearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('data');
    params.delete('municipioId');
    params.delete('peritoId');
    params.delete('colaboradorId');
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Input
        placeholder="Buscar por número do processo"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="max-w-xs"
      />
      <Select
        defaultValue={searchParams.get('situacao') ?? 'all'}
        onValueChange={(value) => updateParam('situacao', !value || value === 'all' ? '' : value)}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Situação" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas as situações</SelectItem>
          {situacaoOptions.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <Label htmlFor="data-filtro" className="sr-only">Data</Label>
        <Input
          id="data-filtro" type="date" className="w-40"
          defaultValue={searchParams.get('data') ?? ''}
          onChange={(e) => updateParam('data', e.target.value)}
        />
      </div>
      <div className="w-56">
        <MunicipioCombobox
          value={municipioId ? Number(municipioId) : null}
          selected={null}
          onChange={(municipio) => updateParam('municipioId', String(municipio.id))}
        />
      </div>
      <div className="w-56">
        <OptionCombobox
          options={peritos}
          value={peritoId ? Number(peritoId) : null}
          onChange={(id) => updateParam('peritoId', String(id))}
          placeholder="Perito"
        />
      </div>
      <div className="w-56">
        <OptionCombobox
          options={colaboradores}
          value={colaboradorId ? Number(colaboradorId) : null}
          onChange={(id) => updateParam('colaboradorId', String(id))}
          placeholder="Colaborador"
        />
      </div>
      <Button type="button" variant="outline" onClick={handleClearFilters}>
        Limpar filtros
      </Button>
    </div>
  );
}
