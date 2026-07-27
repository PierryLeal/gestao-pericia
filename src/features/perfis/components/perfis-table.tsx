'use client';

import { useState, useTransition } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { updateProfileRole, type ProfileRow } from '../actions';
import { roleOptions } from '../schemas';

export function PerfisTable({ profiles }: { profiles: ProfileRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {error && <p className="text-sm text-destructive">{error}</p>}
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
                    startTransition(async () => {
                      setError(null);
                      const result = await updateProfileRole(profile.id, role as ProfileRow['role']);
                      if (!result.success) {
                        setError(result.error);
                      }
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
    </>
  );
}
