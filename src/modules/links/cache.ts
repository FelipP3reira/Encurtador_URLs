import { redis } from '../../shared/redis/cliente.js';

export interface EntradaCacheLink {
  id: string;
  urlDestino: string;
  expiraEm: number | null;
  temSenha: boolean;
}

const PREFIXO = 'link:';
const TTL_PADRAO_SEGUNDOS = 300;
const TTL_NEGATIVO_SEGUNDOS = 30;
const SENTINELA_NEGATIVA = '0';

export type ResultadoCache = EntradaCacheLink | 'NAO_EXISTE' | null;

export async function lerCache(slug: string): Promise<ResultadoCache> {
  const cru = await redis.get(`${PREFIXO}${slug}`);
  if (cru === null) {
    return null;
  }
  if (cru === SENTINELA_NEGATIVA) {
    return 'NAO_EXISTE';
  }
  return JSON.parse(cru) as EntradaCacheLink;
}

export async function salvarCache(slug: string, entrada: EntradaCacheLink): Promise<void> {
  let ttl = TTL_PADRAO_SEGUNDOS;
  if (entrada.expiraEm !== null) {
    const restante = Math.ceil((entrada.expiraEm - Date.now()) / 1000);
    ttl = Math.min(TTL_PADRAO_SEGUNDOS, Math.max(1, restante));
  }
  await redis.set(`${PREFIXO}${slug}`, JSON.stringify(entrada), 'EX', ttl);
}

// Cacheia "não existe" por pouco tempo para um scan de slugs aleatórios não
// martelar o Postgres a cada 404.
export async function salvarCacheNegativo(slug: string): Promise<void> {
  await redis.set(`${PREFIXO}${slug}`, SENTINELA_NEGATIVA, 'EX', TTL_NEGATIVO_SEGUNDOS);
}

export async function invalidarCache(slug: string): Promise<void> {
  await redis.del(`${PREFIXO}${slug}`);
}
