import { Prisma, type Link } from '@prisma/client';

import { ErroAplicacao, ErroConflito } from '../../shared/erros/erros-aplicacao.js';
import { gerarHashSenha } from '../../shared/hash/senha.js';
import { prisma } from '../../shared/prisma/cliente.js';
import { gerarSlug } from '../../shared/slug/slug.js';
import type { CriarLink } from './links.schema.js';

const MAX_TENTATIVAS_SLUG = 5;

export async function criarLink(dados: CriarLink): Promise<Link> {
  const senhaHash = dados.senha ? await gerarHashSenha(dados.senha) : null;

  if (dados.slug) {
    return criarComSlugEscolhido(dados.slug, dados, senhaHash);
  }
  return criarComSlugAleatorio(dados, senhaHash);
}

async function criarComSlugEscolhido(
  slug: string,
  dados: CriarLink,
  senhaHash: string | null,
): Promise<Link> {
  try {
    return await inserir(slug, dados, senhaHash);
  } catch (erro) {
    if (violouUnicidade(erro)) {
      throw new ErroConflito('Esse slug já está em uso.');
    }
    throw erro;
  }
}

async function criarComSlugAleatorio(dados: CriarLink, senhaHash: string | null): Promise<Link> {
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_SLUG; tentativa += 1) {
    try {
      return await inserir(gerarSlug(), dados, senhaHash);
    } catch (erro) {
      if (!violouUnicidade(erro)) {
        throw erro;
      }
      // Colisão (rara): tenta outro slug.
    }
  }
  throw new ErroAplicacao({
    codigo: 'SLUG_INDISPONIVEL',
    mensagem: 'Não consegui gerar um slug livre agora. Tenta de novo.',
    status: 503,
  });
}

function inserir(slug: string, dados: CriarLink, senhaHash: string | null): Promise<Link> {
  return prisma.link.create({
    data: {
      slug,
      urlDestino: dados.url,
      senhaHash,
      expiraEm: dados.expiraEm ?? null,
    },
  });
}

function violouUnicidade(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002';
}
