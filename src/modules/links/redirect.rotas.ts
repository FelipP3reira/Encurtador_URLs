import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { resolverParaRedirect } from './redirect.service.js';

const slugParamSchema = z.object({ slug: z.string().min(1) });

export function redirectRotas(app: FastifyInstance): void {
  app.get('/:slug', async (request, reply) => {
    const { slug } = slugParamSchema.parse(request.params);
    const destino = await resolverParaRedirect(slug, request.headers.referer ?? null);
    return reply.redirect(destino, 302);
  });
}
