import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app.js';
import { contarPendentes } from '../src/modules/cliques/fila-cliques.js';
import { persistirCliquesPendentes } from '../src/modules/cliques/flusher.js';
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

describe('flusher de cliques', () => {
  it('persiste os cliques enfileirados em batch e soma o total no link', async () => {
    const slug = await criarLink({ url: 'https://exemplo.com' });
    for (let i = 0; i < 3; i += 1) {
      await app.inject({
        method: 'GET',
        url: `/${slug}`,
        headers: { referer: 'https://twitter.com' },
      });
    }

    expect(await contarPendentes()).toBe(3);

    const persistidos = await persistirCliquesPendentes();
    expect(persistidos).toBe(3);
    expect(await contarPendentes()).toBe(0);

    const link = await prisma.link.findUniqueOrThrow({ where: { slug } });
    expect(link.totalCliques).toBe(3);
    expect(await prisma.clique.count({ where: { linkId: link.id } })).toBe(3);
  });
});

describe('link com senha (unlock)', () => {
  it('libera o destino com a senha certa e conta o acesso', async () => {
    const slug = await criarLink({ url: 'https://exemplo.com/secreto', senha: 'segredo' });

    const errada = await app.inject({
      method: 'POST',
      url: `/${slug}/unlock`,
      payload: { senha: 'chute' },
    });
    expect(errada.statusCode).toBe(401);

    const certa = await app.inject({
      method: 'POST',
      url: `/${slug}/unlock`,
      payload: { senha: 'segredo' },
    });
    expect(certa.statusCode).toBe(200);
    expect(certa.json().url).toBe('https://exemplo.com/secreto');
    expect(await contarPendentes()).toBe(1);
  });

  it('devolve 404 ao desbloquear slug inexistente', async () => {
    const resposta = await app.inject({
      method: 'POST',
      url: '/naoexiste/unlock',
      payload: { senha: 'x' },
    });
    expect(resposta.statusCode).toBe(404);
  });
});
