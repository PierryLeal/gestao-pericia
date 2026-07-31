import Link from 'next/link';
import { RedefinirSenhaForm } from '@/features/auth/components/redefinir-senha-form';

export default function RedefinirSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="font-heading text-xl font-semibold">Definir nova senha</h1>
        <RedefinirSenhaForm />
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
