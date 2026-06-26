import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import { z } from 'zod';

extendZodWithOpenApi(z);

const registro = new OpenAPIRegistry();

const erroSchema = registro.register(
  'Erro',
  z.object({
    erro: z.object({
      codigo: z.string(),
      mensagem: z.string(),
      detalhes: z.unknown().optional(),
    }),
  }),
);

const linkSchema = registro.register(
  'Link',
  z.object({
    slug: z.string(),
    urlCurta: z.string(),
    urlDestino: z.string(),
    temSenha: z.boolean(),
    expiraEm: z.string().datetime().nullable(),
    totalCliques: z.number().int(),
    criadoEm: z.string().datetime(),
  }),
);

const estatisticasSchema = registro.register(
  'Estatisticas',
  z.object({
    slug: z.string(),
    urlDestino: z.string(),
    totalCliques: z.number().int(),
    periodo: z.object({ de: z.string().nullable(), ate: z.string().nullable() }).nullable(),
    porReferer: z.array(z.object({ referer: z.string(), cliques: z.number().int() })),
    porDia: z.array(z.object({ dia: z.string(), cliques: z.number().int() })),
  }),
);

const criarLinkBody = z.object({
  url: z.string().openapi({ example: 'https://exemplo.com/uma-pagina' }),
  slug: z.string().optional().openapi({ example: 'meu-link' }),
  expiraEm: z.string().optional().openapi({ example: '2027-01-01T00:00:00Z' }),
  senha: z.string().optional(),
});

const slugParam = z.object({ slug: z.string() });

function json(description: string, schema: z.ZodTypeAny) {
  return { description, content: { 'application/json': { schema } } };
}

function corpo(schema: z.ZodTypeAny) {
  return { content: { 'application/json': { schema } } };
}

function erro(description: string) {
  return json(description, erroSchema);
}

registro.registerPath({
  method: 'post',
  path: '/v1/links',
  tags: ['Links'],
  summary: 'Cria um link curto',
  request: { body: corpo(criarLinkBody) },
  responses: {
    201: json('Link criado', linkSchema),
    400: erro('Dados inválidos'),
    409: erro('Slug já em uso'),
  },
});

registro.registerPath({
  method: 'get',
  path: '/v1/links/{slug}',
  tags: ['Links'],
  summary: 'Estatísticas do link (total, por referer e por dia)',
  request: {
    params: slugParam,
    query: z.object({ de: z.string().optional(), ate: z.string().optional() }),
  },
  responses: { 200: json('Estatísticas', estatisticasSchema), 404: erro('Link não encontrado') },
});

registro.registerPath({
  method: 'get',
  path: '/{slug}',
  tags: ['Redirect'],
  summary: 'Redireciona para o destino e contabiliza o clique',
  request: { params: slugParam },
  responses: {
    302: { description: 'Redirect para a URL de destino' },
    401: erro('Link protegido por senha'),
    404: erro('Link não encontrado'),
    410: erro('Link expirado'),
  },
});

registro.registerPath({
  method: 'post',
  path: '/{slug}/unlock',
  tags: ['Redirect'],
  summary: 'Valida a senha do link e devolve o destino',
  request: { params: slugParam, body: corpo(z.object({ senha: z.string() })) },
  responses: {
    200: json('Destino liberado', z.object({ url: z.string() })),
    401: erro('Senha incorreta'),
    404: erro('Link não encontrado'),
    410: erro('Link expirado'),
  },
});

export function gerarDocumentoOpenApi(): OpenAPIObject {
  const gerador = new OpenApiGeneratorV3(registro.definitions);
  return gerador.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Encurtador de URLs',
      version: '1.0.0',
      description: 'Encurtamento de URLs com slug customizável, senha, expiração e analytics.',
    },
    servers: [{ url: '/' }],
  });
}
