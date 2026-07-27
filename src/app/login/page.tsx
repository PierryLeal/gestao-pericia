import { signInWithGoogle } from '@/features/auth/actions';
import { LoginForm } from '@/features/auth/components/login-form';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Gestão de Perícias</h1>
        <form action={signInWithGoogle}>
          <Button type="submit" variant="outline" className="w-full">
            Entrar com Google
          </Button>
        </form>
        <div className="relative text-center text-xs text-muted-foreground">
          <span className="bg-background px-2">ou</span>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
