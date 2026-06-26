import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';

import { config } from './config/env.js';
import { linksRotas } from './modules/links/links.rotas.js';
import { redirectRotas } from './modules/links/redirect.rotas.js';
import { registrarTratamentoDeErro } from './shared/http/erro-handler.js';
import { montarCorpoErro } from './shared/http/resposta-erro.js';

export async function criarApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(helmet);

  // Rate limit por rota (global: false): aplico onde marco config.rateLimit,
  // como na criação de link. Em teste fica de fora para não atrapalhar a suíte.
  if (config.NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      global: false,
      errorResponseBuilder: (_request, contexto) =>
        montarCorpoErro(
          'LIMITE_EXCEDIDO',
          `Muitas requisições. Tente de novo em ${Math.ceil(contexto.ttl / 1000)}s.`,
        ),
    });
  }

  registrarTratamentoDeErro(app);

  app.get('/health', () => ({ status: 'ok' }));

  await app.register(linksRotas, { prefix: '/v1/links' });
  // Redirect na raiz — registrado por último; rotas estáticas (/health, /v1/*)
  // têm prioridade sobre o parâmetro /:slug no Fastify.
  await app.register(redirectRotas);

  return app;
}
