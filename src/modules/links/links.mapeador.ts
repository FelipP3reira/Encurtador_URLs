import type { Link } from '@prisma/client';

import { config } from '../../config/env.js';

export function apresentarLink(link: Link) {
  return {
    slug: link.slug,
    urlCurta: `${config.BASE_URL}/${link.slug}`,
    urlDestino: link.urlDestino,
    temSenha: link.senhaHash !== null,
    expiraEm: link.expiraEm,
    totalCliques: link.totalCliques,
    criadoEm: link.criadoEm,
  };
}
