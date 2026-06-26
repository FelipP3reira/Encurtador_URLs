import type { FastifyInstance } from 'fastify';

import { apresentarLink } from './links.mapeador.js';
import { criarLinkSchema } from './links.schema.js';
import * as links from './links.service.js';

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
}
