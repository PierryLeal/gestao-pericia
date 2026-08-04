import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Calendário</h1>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="w-full shrink-0 lg:w-64">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-[600px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
