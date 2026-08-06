'use client';

import { PencilLine } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function CampoMesclagemLabel({
  htmlFor,
  children,
  editado,
}: {
  htmlFor: string;
  children: React.ReactNode;
  editado: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{children}</Label>
      {editado && (
        <Tooltip>
          <TooltipTrigger
            render={(
              <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400" />
            )}
          >
            <PencilLine className="size-2.5" />
            editado
          </TooltipTrigger>
          <TooltipContent>
            Valor alterado manualmente ao trocar entre os candidatos — ainda não está salvo em nenhum dos
            registros originais. Ele fica assim mesmo se você trocar de candidato de novo.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
