import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app.js';
import { contarPendentes } from '../src/modules/cliques/fila-cliques.js';
import { prisma } from '../src/shared/prisma/cliente.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});

afterAll(async () => {
  await app.close();
});

async function criarLink(payload: Record<string, unknown>): Promise<string> {
  const resposta = await app.inject({ method: 'POST', url: '/v1/links', payload });
  return resposta.json().slug as string;
}

describe('redirect', () => {
  it('redireciona com 302 e enfileira o clique', async () => {
    const slug = await criarLink({ url: 'https://exemplo.com/destino' });

    const resposta = await app.inject({ method: 'GET', url: `/${slug}` });

    expect(resposta.statusCode).toBe(302);
    expect(resposta.headers.location).toBe('https://exemplo.com/destino');
    expect(await contarPendentes()).toBe(1);
  });

  it('serve do cache mesmo se o registro sumir do banco', async () => {
    const slug = await criarLink({ url: 'https://exemplo.com/cacheado' });

    await app.inject({ method: 'GET', url: `/${slug}` }); // popula o cache
    await prisma.link.delete({ where: { slug } }); // some do banco

    const resposta = await app.inject({ method: 'GET', url: `/${slug}` });
    expect(resposta.statusCode).toBe(302);
    expect(resposta.headers.location).toBe('https://exemplo.com/cacheado');
  });

  it('devolve 404 para slug inexistente', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/naoexiste' });
    expect(resposta.statusCode).toBe(404);
  });

  it('devolve 410 para link expirado', async () => {
    await prisma.link.create({
      data: {
        slug: 'expirado',
        urlDestino: 'https://exemplo.com',
        expiraEm: new Date('2020-01-01T00:00:00Z'),
      },
    });

    const resposta = await app.inject({ method: 'GET', url: '/expirado' });
    expect(resposta.statusCode).toBe(410);
    expect(resposta.json().erro.codigo).toBe('EXPIRADO');
  });

  it('devolve 401 para link protegido por senha (sem contar clique)', async () => {
    const slug = await criarLink({ url: 'https://exemplo.com', senha: 'segredo' });

    const resposta = await app.inject({ method: 'GET', url: `/${slug}` });
    expect(resposta.statusCode).toBe(401);
    expect(await contarPendentes()).toBe(0);
  });
});
