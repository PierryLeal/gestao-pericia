'use client';

import { Button } from '@/components/ui/button';

function messageFor(error: Error & { digest?: string }): string {
  if (error.message === 'UNAUTHENTICATED') {
    return 'Sua sessão expirou. Faça login novamente.';
  }
  if (error.message === 'FORBIDDEN') {
    return 'Você não tem permissão para acessar esta página.';
  }
  return 'Algo deu errado. Tente novamente.';
}

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">Ocorreu um erro</h1>
      <p className="max-w-md text-sm text-muted-foreground">{messageFor(error)}</p>
      <Button type="button" onClick={reset}>
        Tentar novamente
      </Button>
    </div>
  );
}
