import { prisma } from '../../shared/prisma/cliente.js';
import { drenarFila, type CliqueEnfileirado } from './fila-cliques.js';

const TAMANHO_LOTE = 500;

// Drena a fila de cliques do Redis e persiste em batch: insere as linhas de
// Clique e soma os totais por link numa transação. Roda num intervalo no
// servidor e é chamado direto nos testes.
export async function persistirCliquesPendentes(): Promise<number> {
  let totalPersistido = 0;

  for (;;) {
    const lote = await drenarFila(TAMANHO_LOTE);
    if (lote.length === 0) {
      break;
    }
    await persistirLote(lote);
    totalPersistido += lote.length;
    if (lote.length < TAMANHO_LOTE) {
      break;
    }
  }

  return totalPersistido;
}

async function persistirLote(lote: CliqueEnfileirado[]): Promise<void> {
  const contagemPorLink = new Map<string, number>();
  for (const clique of lote) {
    contagemPorLink.set(clique.linkId, (contagemPorLink.get(clique.linkId) ?? 0) + 1);
  }

  await prisma.$transaction([
    prisma.clique.createMany({
      data: lote.map((clique) => ({
        linkId: clique.linkId,
        referer: clique.referer,
        criadoEm: new Date(clique.ts),
      })),
    }),
    ...[...contagemPorLink].map(([linkId, quantidade]) =>
      prisma.link.update({
        where: { id: linkId },
        data: { totalCliques: { increment: quantidade } },
      }),
    ),
  ]);
}
