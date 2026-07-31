import { z } from 'zod';

export const updateNomeSchema = z.object({ nome: z.string().min(1, 'Nome é obrigatório') });
export const updatePasswordSchema = z.object({ password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres') });
