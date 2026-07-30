'use client';

import { useEffect, useState, type TransitionStartFunction } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export function PeritosFilters({
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
      startTransition(() => router.push(`/peritos?${params.toString()}`));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <Card size="sm">
      <CardContent>
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="busca-peritos">Buscar</Label>
          <Input
            id="busca-peritos"
            placeholder="Nome"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
