'use client';

import { useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateProfileRole, type ProfileRow } from '../actions';
import { roleOptions } from '../schemas';

export function PerfisTable({ profiles }: { profiles: ProfileRow[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Perfil</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {profiles.map((profile) => (
          <TableRow key={profile.id}>
            <TableCell>{profile.nome}</TableCell>
            <TableCell>{profile.email}</TableCell>
            <TableCell>
              <Select
                value={profile.role}
                disabled={isPending}
                onValueChange={(role) =>
                  startTransition(() => {
                    updateProfileRole(profile.id, role as ProfileRow['role']);
                  })
                }
              >
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
