import { z } from 'zod';

export const roleOptions = ['pendente', 'gerencia', 'admin'] as const;
export type Role = (typeof roleOptions)[number];

export const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(roleOptions),
});
