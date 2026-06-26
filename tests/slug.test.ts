import { describe, expect, it } from 'vitest';

import { ehSlugReservado, FORMATO_SLUG, gerarSlug } from '../src/shared/slug/slug.js';

describe('gerador de slug', () => {
  it('gera slug com o tamanho pedido e só caracteres base62', () => {
    const slug = gerarSlug();

    expect(slug).toHaveLength(7);
    expect(slug).toMatch(/^[A-Za-z0-9]{7}$/);
  });

  it('não repete em muitas gerações (sem colisão na prática)', () => {
    const gerados = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      gerados.add(gerarSlug());
    }
    expect(gerados.size).toBe(2000);
  });

  it('reconhece slugs reservados', () => {
    expect(ehSlugReservado('health')).toBe(true);
    expect(ehSlugReservado('V1')).toBe(true);
    expect(ehSlugReservado('meu-link')).toBe(false);
  });

  it('valida o formato de slug customizado', () => {
    expect(FORMATO_SLUG.test('meu-link_1')).toBe(true);
    expect(FORMATO_SLUG.test('ab')).toBe(false);
    expect(FORMATO_SLUG.test('com espaço')).toBe(false);
  });
});
