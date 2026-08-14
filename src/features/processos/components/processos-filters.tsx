'use client';

import { useEffect, useState, type TransitionStartFunction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export function ProcessosFilters({
  startTransition = (callback) => callback(),
}: {
  startTransition?: TransitionStartFunction;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(searchParams.get('busca') ?? '');

  useEffect(() => {
    if (busca === (searchParams.get('busca') ?? '')) return;
    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (busca) params.set('busca', busca);
      else params.delete('busca');
      startTransition(() => router.push(`/processos?${params.toString()}`));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <Card size="sm">
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="busca-processos">Buscar</Label>
            <Input
              id="busca-processos"
              placeholder="Número, autor ou réu"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
