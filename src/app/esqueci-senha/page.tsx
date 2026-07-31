import Link from 'next/link';
import { EsqueciSenhaForm } from '@/features/auth/components/esqueci-senha-form';

export default function EsqueciSenhaPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
        <div className="space-y-1.5">
          <h1 className="font-heading text-xl font-semibold">Esqueci minha senha</h1>
          <p className="text-sm text-muted-foreground">Informe seu e-mail para receber um link de recuperação.</p>
        </div>
        <EsqueciSenhaForm />
        <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
