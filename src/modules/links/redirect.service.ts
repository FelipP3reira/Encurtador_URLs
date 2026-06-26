import {
  ErroExpirado,
  ErroNaoAutorizado,
  ErroNaoEncontrado,
} from '../../shared/erros/erros-aplicacao.js';
import { prisma } from '../../shared/prisma/cliente.js';
import { enfileirarClique } from '../cliques/fila-cliques.js';
import { lerCache, salvarCache, salvarCacheNegativo, type EntradaCacheLink } from './cache.js';

export async function resolverParaRedirect(slug: string, referer: string | null): Promise<string> {
  const entrada = await obterEntrada(slug);

  if (entrada.expiraEm !== null && entrada.expiraEm <= Date.now()) {
    throw new ErroExpirado('Esse link expirou.');
  }
  if (entrada.temSenha) {
    throw new ErroNaoAutorizado('Esse link é protegido por senha. Acesse via POST /:slug/unlock.');
  }

  await enfileirarClique(entrada.id, referer);
  return entrada.urlDestino;
}

async function obterEntrada(slug: string): Promise<EntradaCacheLink> {
  const cacheado = await lerCache(slug);
  if (cacheado === 'NAO_EXISTE') {
    throw new ErroNaoEncontrado('Link não encontrado.');
  }
  if (cacheado) {
    return cacheado;
  }

  const link = await prisma.link.findUnique({ where: { slug } });
  if (!link || !link.ativo) {
    await salvarCacheNegativo(slug);
    throw new ErroNaoEncontrado('Link não encontrado.');
  }

  const entrada: EntradaCacheLink = {
    id: link.id,
    urlDestino: link.urlDestino,
    expiraEm: link.expiraEm ? link.expiraEm.getTime() : null,
    temSenha: link.senhaHash !== null,
  };
  await salvarCache(slug, entrada);
  return entrada;
}
