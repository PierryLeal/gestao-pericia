'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { situacaoOptions } from '../schemas';

export function PericiasFilters() {
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

  return (
    <div className="flex gap-3">
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
    </div>
  );
}
