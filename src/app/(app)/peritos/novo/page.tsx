import { PeritoForm } from '@/features/peritos/components/perito-form';

export default function NovoPeritoPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Novo perito</h1>
      <PeritoForm />
    </div>
  );
}
