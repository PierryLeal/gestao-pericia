import { z } from 'zod';

export const roleOptions = ['pendente', 'gerencia', 'admin'] as const;
export type Role = (typeof roleOptions)[number];

export const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(roleOptions),
});

export const createUserSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  role: z.enum(roleOptions),
});
