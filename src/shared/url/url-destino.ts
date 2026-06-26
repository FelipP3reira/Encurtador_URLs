import { z } from 'zod';

const ESQUEMAS_PERMITIDOS = new Set(['http:', 'https:']);

// Só http/https, com host plausível. Bloqueia esquemas perigosos
// (javascript:, data:, file:...) que poderiam virar um redirect malicioso.
export const urlDestinoSchema = z
  .string()
  .trim()
  .min(1, 'Informe a URL.')
  .max(2048, 'URL longa demais.')
  .superRefine((valor, ctx) => {
    let url: URL;
    try {
      url = new URL(valor);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'URL inválida.' });
      return;
    }

    if (!ESQUEMAS_PERMITIDOS.has(url.protocol)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Só aceitamos links http e https.',
      });
      return;
    }

    if (!url.hostname.includes('.')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Informe um host válido.' });
    }
  });
