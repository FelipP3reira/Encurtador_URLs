import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { apresentarLink } from './links.mapeador.js';
import { criarLinkSchema, statsQuerySchema } from './links.schema.js';
import * as links from './links.service.js';
import { obterEstatisticas } from './stats.service.js';

const slugParamSchema = z.object({ slug: z.string().min(1) });

export function linksRotas(app: FastifyInstance): void {
  app.post(
    '/',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const dados = criarLinkSchema.parse(request.body);
      const link = await links.criarLink(dados);
      return reply.status(201).send(apresentarLink(link));
    },
  );

  app.get('/:slug', async (request, reply) => {
    const { slug } = slugParamSchema.parse(request.params);
    const { de, ate } = statsQuerySchema.parse(request.query);
    const estatisticas = await obterEstatisticas(slug, de ?? null, ate ?? null);
    return reply.send(estatisticas);
  });
}
