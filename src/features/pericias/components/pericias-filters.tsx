'use client';

import { useEffect, useRef, useState, type TransitionStartFunction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MunicipioCombobox } from '@/features/municipios/components/municipio-combobox';
import { OptionCombobox } from '@/components/shared/option-combobox';
import { ContratoFiltro } from '@/components/shared/contrato-filtro';
import { parseContratos, serializeContratos } from '@/lib/contratos';
import { situacaoOptions } from '../schemas';
import type { MunicipioIBGE } from '@/lib/ibge/client';

type PeritoOption = { id: number; nome: string };
type ColaboradorOption = { id: number; nome: string };

export function PericiasFilters({
  peritos,
  colaboradores,
  municipio,
  startTransition = (callback) => callback(),
}: {
  peritos: PeritoOption[];
  colaboradores: ColaboradorOption[];
  municipio: MunicipioIBGE | null;
  startTransition?: TransitionStartFunction;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');
  const suppressBuscaDebounce = useRef(false);

  useEffect(() => {
    if (busca === (searchParams.get('busca') ?? '')) return;
    if (suppressBuscaDebounce.current) {
      // "Limpar filtros" already pushed the cleared URL directly — skip this
      // debounce round so it can't read a not-yet-landed URL and resurrect
      // the other filters that were just cleared.
      suppressBuscaDebounce.current = false;
      return;
    }
    const handle = setTimeout(() => updateParam('busca', busca), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  function updateParam(key: string, value: string) {
    // Reads the live URL instead of the `searchParams` snapshot this closure was
    // created with, so a debounced update (e.g. busca, scheduled 300ms earlier)
    // can't clobber a more recent change — like "Limpar filtros" — with stale params.
    const current = new URLSearchParams(window.location.search);
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    // Re-selecting the same value (e.g. clicking the already-selected combobox
    // option) would otherwise still trigger a navigation and its loading state.
    if (params.toString() === current.toString()) return;
    startTransition(() => router.push(`/?${params.toString()}`));
  }

  const situacao = searchParams.get('situacao') ?? 'all';
  const situacaoItems = {
    all: 'Todas as situações',
    ...Object.fromEntries(situacaoOptions.map((s) => [s, s])),
  };
  const municipioId = searchParams.get('municipioId');
  const peritoId = searchParams.get('peritoId');
  const colaboradorId = searchParams.get('colaboradorId');
  const hasActiveFilters = Boolean(
    searchParams.get('busca') ||
      searchParams.get('situacao') ||
      searchParams.get('dataInicio') ||
      searchParams.get('dataFim') ||
      searchParams.get('contrato') ||
      municipioId ||
      peritoId ||
      colaboradorId
  );

  function handleClearFilters() {
    suppressBuscaDebounce.current = true;
    setBusca('');
    startTransition(() => router.push('/'));
  }

  return (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Filtros</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
          >
            Limpar filtros
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="busca-filtro">Buscar</Label>
            <Input
              id="busca-filtro"
              placeholder="Número, autor ou réu"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="situacao-filtro">Situação</Label>
            <Select
              items={situacaoItems}
              value={situacao}
              onValueChange={(value) => updateParam('situacao', !value || value === 'all' ? '' : value)}
            >
              <SelectTrigger id="situacao-filtro" className="w-full">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                {situacaoOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Data</Label>
            <div className="flex items-center gap-1">
              <Input
                type="date" aria-label="Data inicial"
                value={searchParams.get('dataInicio') ?? ''}
                onChange={(e) => updateParam('dataInicio', e.target.value)}
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date" aria-label="Data final"
                value={searchParams.get('dataFim') ?? ''}
                onChange={(e) => updateParam('dataFim', e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Local</Label>
            <MunicipioCombobox
              value={municipioId ? Number(municipioId) : null}
              selected={municipio}
              onChange={(m) => updateParam('municipioId', String(m.id))}
              onClear={() => updateParam('municipioId', '')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Perito</Label>
            <OptionCombobox
              options={peritos}
              value={peritoId ? Number(peritoId) : null}
              onChange={(id) => updateParam('peritoId', String(id))}
              onClear={() => updateParam('peritoId', '')}
              placeholder="Perito"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Colaborador</Label>
            <OptionCombobox
              options={colaboradores}
              value={colaboradorId ? Number(colaboradorId) : null}
              onChange={(id) => updateParam('colaboradorId', String(id))}
              onClear={() => updateParam('colaboradorId', '')}
              placeholder="Colaborador"
            />
          </div>
          <ContratoFiltro
            id="contrato-filtro"
            value={parseContratos(searchParams.get('contrato'))}
            onChange={(value) => updateParam('contrato', serializeContratos(value))}
          />
        </div>
      </CardContent>
    </Card>
  );
}
