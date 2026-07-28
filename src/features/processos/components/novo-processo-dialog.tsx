'use client';

import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProcessoForm } from './processo-form';
import type { Processo } from '../actions';

export function NovoProcessoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (processo: Processo) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo processo</DialogTitle>
        </DialogHeader>
        <ProcessoForm
          submitLabel="Salvar e vincular"
          onSaved={(processo) => {
            toast.success('Processo criado com sucesso');
            onCreated(processo);
            onOpenChange(false);
          }}
          onError={(message) => toast.error(message)}
        />
      </DialogContent>
    </Dialog>
  );
}
