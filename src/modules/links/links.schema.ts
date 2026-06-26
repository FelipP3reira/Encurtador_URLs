import { z } from 'zod';

import { ehSlugReservado, FORMATO_SLUG } from '../../shared/slug/slug.js';
import { urlDestinoSchema } from '../../shared/url/url-destino.js';

export const criarLinkSchema = z.object({
  url: urlDestinoSchema,
  slug: z
    .string()
    .trim()
    .regex(FORMATO_SLUG, 'Slug deve ter 3-40 caracteres: letras, números, hífen ou underline.')
    .refine((slug) => !ehSlugReservado(slug), 'Esse slug é reservado.')
    .optional(),
  expiraEm: z.coerce
    .date()
    .refine((data) => data.getTime() > Date.now(), 'A expiração precisa ser no futuro.')
    .optional(),
  senha: z.string().min(4, 'A senha do link precisa de ao menos 4 caracteres.').max(200).optional(),
});

export const desbloquearSchema = z.object({
  senha: z.string().min(1, 'Informe a senha.'),
});

export const statsQuerySchema = z
  .object({
    de: z.coerce.date().optional(),
    ate: z.coerce.date().optional(),
  })
  .refine((q) => q.de === undefined || q.ate === undefined || q.de <= q.ate, {
    message: 'de não pode ser depois de ate.',
    path: ['de'],
  });

export type CriarLink = z.infer<typeof criarLinkSchema>;
export type StatsQuery = z.infer<typeof statsQuerySchema>;
