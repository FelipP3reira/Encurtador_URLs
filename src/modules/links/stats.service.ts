import { Prisma } from '@prisma/client';

import { ErroNaoEncontrado } from '../../shared/erros/erros-aplicacao.js';
import { prisma } from '../../shared/prisma/cliente.js';

export interface Estatisticas {
  slug: string;
  urlDestino: string;
  totalCliques: number;
  periodo: { de: Date | null; ate: Date | null } | null;
  porReferer: { referer: string; cliques: number }[];
  porDia: { dia: Date; cliques: number }[];
}

// O painel lê os cliques já persistidos (o flusher roda em intervalo), então é
// eventualmente consistente — pode haver um atraso de poucos segundos.
export async function obterEstatisticas(
  slug: string,
  de: Date | null,
  ate: Date | null,
): Promise<Estatisticas> {
  const link = await prisma.link.findUnique({
    where: { slug },
    select: { id: true, slug: true, urlDestino: true },
  });
  if (!link) {
    throw new ErroNaoEncontrado('Link não encontrado.');
  }

  const filtro: Prisma.CliqueWhereInput = { linkId: link.id };
  if (de || ate) {
    filtro.criadoEm = { ...(de ? { gte: de } : {}), ...(ate ? { lte: ate } : {}) };
  }

  const [total, porRefererBruto, porDia] = await Promise.all([
    prisma.clique.count({ where: filtro }),
    prisma.clique.groupBy({ by: ['referer'], where: filtro, _count: { _all: true } }),
    contarPorDia(link.id, de, ate),
  ]);

  const porReferer = porRefererBruto
    .map((linha) => ({ referer: linha.referer ?? 'direto', cliques: linha._count._all }))
    .sort((a, b) => b.cliques - a.cliques);

  return {
    slug: link.slug,
    urlDestino: link.urlDestino,
    totalCliques: total,
    periodo: de || ate ? { de, ate } : null,
    porReferer,
    porDia,
  };
}

async function contarPorDia(
  linkId: string,
  de: Date | null,
  ate: Date | null,
): Promise<{ dia: Date; cliques: number }[]> {
  const filtros = [Prisma.sql`"linkId" = ${linkId}::uuid`];
  if (de) {
    filtros.push(Prisma.sql`"criadoEm" >= ${de}`);
  }
  if (ate) {
    filtros.push(Prisma.sql`"criadoEm" <= ${ate}`);
  }

  const linhas = await prisma.$queryRaw<{ dia: Date; total: number }[]>(Prisma.sql`
    SELECT date_trunc('day', "criadoEm") AS dia, count(*)::int AS total
    FROM cliques
    WHERE ${Prisma.join(filtros, ' AND ')}
    GROUP BY dia
    ORDER BY dia ASC
  `);

  return linhas.map((linha) => ({ dia: linha.dia, cliques: linha.total }));
}
