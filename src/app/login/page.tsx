import { signInWithGoogle } from '@/features/auth/actions';
import { LoginForm } from '@/features/auth/components/login-form';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-to-br from-[#0A1614] via-[#123330] to-[#1F5C52] p-12 lg:flex">
        <span className="font-heading text-2xl font-semibold text-foreground">Gestão de Perícias</span>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cadastro e acompanhamento de perícias, processos, peritos e colaboradores em um só lugar.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-8 shadow-sm">
          <h1 className="font-heading text-xl font-semibold lg:hidden">Gestão de Perícias</h1>
          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" className="w-full">
              Entrar com Google
            </Button>
          </form>
          <div className="relative text-center text-xs text-muted-foreground">
            <span className="bg-card px-2">ou</span>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
