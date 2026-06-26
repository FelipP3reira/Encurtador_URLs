import { redis } from '../../shared/redis/cliente.js';

const CHAVE_FILA = 'cliques:fila';

export interface CliqueEnfileirado {
  linkId: string;
  referer: string | null;
  ts: number;
}

// Enfileira o clique no Redis e volta na hora — o caminho do redirect não toca
// o Postgres. Um flusher em batch drena essa fila depois.
export async function enfileirarClique(linkId: string, referer: string | null): Promise<void> {
  const evento: CliqueEnfileirado = { linkId, referer, ts: Date.now() };
  await redis.rpush(CHAVE_FILA, JSON.stringify(evento));
}

export async function contarPendentes(): Promise<number> {
  return redis.llen(CHAVE_FILA);
}

export async function drenarFila(limite: number): Promise<CliqueEnfileirado[]> {
  const crus = await redis.lpop(CHAVE_FILA, limite);
  if (!crus) {
    return [];
  }
  const lista = Array.isArray(crus) ? crus : [crus];
  return lista.map((cru) => JSON.parse(cru) as CliqueEnfileirado);
}
