import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import type { OpenAPIV3 } from 'openapi-types';

import { config } from './config/env.js';
import { linksRotas } from './modules/links/links.rotas.js';
import { redirectRotas } from './modules/links/redirect.rotas.js';
import { registrarTratamentoDeErro } from './shared/http/erro-handler.js';
import { montarCorpoErro } from './shared/http/resposta-erro.js';
import { gerarDocumentoOpenApi } from './shared/openapi/documento.js';

export async function criarApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // CSP padrão bloqueia o inline do Swagger UI; liberamos o necessário para a
  // página de /docs. A API só serve JSON/redirect, então é um afrouxamento localizado.
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });

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

  const documentoOpenApi = gerarDocumentoOpenApi();
  // zod-to-openapi tipa pelo openapi3-ts e o @fastify/swagger pelo openapi-types:
  // mesma forma, declarações diferentes. A ponte é segura.
  await app.register(swagger, {
    mode: 'static',
    specification: { document: documentoOpenApi as unknown as OpenAPIV3.Document },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  registrarTratamentoDeErro(app);

  app.get('/health', () => ({ status: 'ok' }));
  app.get('/docs.json', () => documentoOpenApi);

  await app.register(linksRotas, { prefix: '/v1/links' });
  // Redirect na raiz — registrado por último; rotas estáticas (/health, /docs,
  // /v1/*) têm prioridade sobre o parâmetro /:slug no Fastify.
  await app.register(redirectRotas);

  return app;
}
