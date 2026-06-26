import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { criarApp } from '../src/app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await criarApp();
});

afterAll(async () => {
  await app.close();
});

function criar(payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: '/v1/links', payload });
}

describe('criação de link', () => {
  it('cria com slug aleatório e devolve a URL curta', async () => {
    const resposta = await criar({ url: 'https://exemplo.com/pagina' });

    expect(resposta.statusCode).toBe(201);
    const corpo = resposta.json();
    expect(corpo.slug).toMatch(/^[A-Za-z0-9]{7}$/);
    expect(corpo.urlCurta).toBe(`http://localhost:3335/${corpo.slug}`);
    expect(corpo.temSenha).toBe(false);
  });

  it('aceita slug customizado', async () => {
    const resposta = await criar({ url: 'https://exemplo.com', slug: 'meu-link' });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().slug).toBe('meu-link');
  });

  it('recusa slug customizado já em uso com 409', async () => {
    await criar({ url: 'https://exemplo.com', slug: 'repetido' });
    const resposta = await criar({ url: 'https://outro.com', slug: 'repetido' });

    expect(resposta.statusCode).toBe(409);
    expect(resposta.json().erro.codigo).toBe('CONFLITO');
  });

  it('recusa slug reservado com 400', async () => {
    const resposta = await criar({ url: 'https://exemplo.com', slug: 'health' });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.detalhes.slug).toBeDefined();
  });

  it('recusa URL com esquema perigoso com 400', async () => {
    const resposta = await criar({ url: 'javascript:alert(1)' });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.detalhes.url).toBeDefined();
  });

  it('recusa expiração no passado com 400', async () => {
    const resposta = await criar({ url: 'https://exemplo.com', expiraEm: '2020-01-01T00:00:00Z' });

    expect(resposta.statusCode).toBe(400);
    expect(resposta.json().erro.detalhes.expiraEm).toBeDefined();
  });

  it('marca temSenha quando o link tem senha', async () => {
    const resposta = await criar({ url: 'https://exemplo.com', senha: 'segredo' });

    expect(resposta.statusCode).toBe(201);
    expect(resposta.json().temSenha).toBe(true);
  });
});
