'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PerfisTable } from './perfis-table';
import { CreateUserForm } from './create-user-form';
import type { ProfileRow } from '../actions';

export function PerfisScreen({ profiles }: { profiles: ProfileRow[] }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  function handleSaved() {
    toast.success('Usuário criado');
    setDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Controle de perfis</h1>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          Novo usuário
        </Button>
      </div>
      <PerfisTable profiles={profiles} />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <CreateUserForm onSaved={handleSaved} onError={(message) => toast.error(message)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
