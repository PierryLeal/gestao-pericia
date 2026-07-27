import { ColaboradorForm } from '@/features/colaboradores/components/colaborador-form';

export default function NovoColaboradorPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Novo colaborador</h1>
      <ColaboradorForm />
    </div>
  );
}
