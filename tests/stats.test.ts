import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app.js';
import { persistirCliquesPendentes } from '../src/modules/cliques/flusher.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});

afterAll(async () => {
  await app.close();
});

async function criarLink(): Promise<string> {
  const resposta = await app.inject({
    method: 'POST',
    url: '/v1/links',
    payload: { url: 'https://exemplo.com' },
  });
  return resposta.json().slug as string;
}

function acessar(slug: string, referer?: string) {
  return app.inject({
    method: 'GET',
    url: `/${slug}`,
    headers: referer ? { referer } : {},
  });
}

describe('painel de estatísticas', () => {
  it('mostra total, quebra por referer e por dia', async () => {
    const slug = await criarLink();
    await acessar(slug, 'https://twitter.com');
    await acessar(slug, 'https://twitter.com');
    await acessar(slug); // direto
    await persistirCliquesPendentes();

    const resposta = await app.inject({ method: 'GET', url: `/v1/links/${slug}` });

    expect(resposta.statusCode).toBe(200);
    const stats = resposta.json();
    expect(stats.totalCliques).toBe(3);
    expect(stats.porReferer).toContainEqual({ referer: 'https://twitter.com', cliques: 2 });
    expect(stats.porReferer).toContainEqual({ referer: 'direto', cliques: 1 });
    expect(stats.porDia.length).toBeGreaterThanOrEqual(1);
    expect(stats.porDia[0].cliques).toBe(3);
  });

  it('devolve 404 para slug inexistente', async () => {
    const resposta = await app.inject({ method: 'GET', url: '/v1/links/naoexiste' });
    expect(resposta.statusCode).toBe(404);
  });
});
