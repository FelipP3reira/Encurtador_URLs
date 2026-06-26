import { randomBytes } from 'node:crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const TAMANHO_PADRAO = 7;

// 62^7 ≈ 3,5 trilhões de combinações: colisão é desprezível e a unique do banco
// garante a correção (com retry no raro empate). Aleatório (não sequencial) para
// os slugs não serem enumeráveis.
export function gerarSlug(tamanho = TAMANHO_PADRAO): string {
  let slug = '';
  for (const byte of randomBytes(tamanho)) {
    slug += ALFABETO.charAt(byte % ALFABETO.length);
  }
  return slug;
}

export const FORMATO_SLUG = /^[A-Za-z0-9_-]{3,40}$/;

const RESERVADOS = new Set(['health', 'docs', 'docs.json', 'v1', 'favicon.ico', 'robots.txt']);

export function ehSlugReservado(slug: string): boolean {
  return RESERVADOS.has(slug.toLowerCase());
}
