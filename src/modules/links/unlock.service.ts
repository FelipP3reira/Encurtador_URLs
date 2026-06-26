import {
  ErroExpirado,
  ErroNaoAutorizado,
  ErroNaoEncontrado,
} from '../../shared/erros/erros-aplicacao.js';
import { conferirSenha } from '../../shared/hash/senha.js';
import { prisma } from '../../shared/prisma/cliente.js';
import { enfileirarClique } from '../cliques/fila-cliques.js';

export async function desbloquearLink(
  slug: string,
  senha: string,
  referer: string | null,
): Promise<string> {
  const link = await prisma.link.findUnique({ where: { slug } });
  if (!link || !link.ativo) {
    throw new ErroNaoEncontrado('Link não encontrado.');
  }
  if (link.expiraEm && link.expiraEm.getTime() <= Date.now()) {
    throw new ErroExpirado('Esse link expirou.');
  }
  if (link.senhaHash && !(await conferirSenha(link.senhaHash, senha))) {
    throw new ErroNaoAutorizado('Senha incorreta.');
  }

  await enfileirarClique(link.id, referer);
  return link.urlDestino;
}
