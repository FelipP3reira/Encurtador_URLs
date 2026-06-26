# Encurtador de URLs

Encurtador de URLs com analytics. Além de gerar o link curto, ele conta cliques
sem atrasar o redirect, guarda referer e período para um painel por link, e
suporta slug customizado, expiração e senha. O esforço aqui foi no caminho
quente (o redirect) e em fazer a contagem escalar sem bater no banco a cada
acesso.

## Stack

- **Node + TypeScript** (ESM, modo estrito)
- **Fastify 5** — erro centralizado, validação na borda
- **Prisma 6 + PostgreSQL 16**
- **Redis 7** — cache de lookup e fila de cliques
- **zod** na validação e como fonte do OpenAPI
- **argon2id** para a senha opcional de link
- **Vitest** com `app.inject` nos testes de integração
- **OpenAPI / Swagger UI** em `/docs`

## Endpoints

| Método | Rota              | O que faz                                              |
| ------ | ----------------- | ------------------------------------------------------ |
| POST   | `/v1/links`       | cria um link curto (slug, senha e expiração opcionais) |
| GET    | `/:slug`          | redireciona (302) e contabiliza o clique               |
| POST   | `/:slug/unlock`   | valida a senha e devolve o destino                     |
| GET    | `/v1/links/:slug` | painel: total, por referer e por dia                   |

## Como rodar

Pré-requisitos: Node 20+ e Docker.

```bash
cp .env.example .env
docker compose up -d        # Postgres em 5435, Redis em 6381
npm install
npm run db:migrate          # aplica as migrations
npm run dev
```

A API sobe em `http://localhost:3335`, com a documentação em
`http://localhost:3335/docs` (JSON em `/docs.json`).

### Testes

```bash
npm test
```

Integração de verdade: batem em Postgres (`encurtador_test`) e Redis reais,
subidos pelo `docker-compose`. **Precisam dos containers de pé** — sem eles o
setup falha. Entre cada teste, as tabelas são truncadas e o Redis é limpo.

## Decisões de arquitetura e trade-offs

**Slug: aleatório base62, não sequencial.** Gero 7 caracteres base62 aleatórios
e confio na `unique` do banco, com retry no raro empate. A alternativa — base62
a partir de um id incremental — daria slugs **enumeráveis**: bastaria varrer
`/1`, `/2`, … para raspar todos os links (vazamento de privacidade). O aleatório
não é adivinhável, e em 62⁷ (≈ 3,5 trilhões) a colisão é desprezível; quando
acontece, a constraint barra e eu gero outro. O custo é só a verificação, que a
própria constraint já faz.

**Contagem de cliques sem bloquear o redirect.** O `GET /:slug` nunca escreve no
Postgres. Ele resolve o destino pelo cache, **enfileira** o clique no Redis
(`rpush`) e responde o 302 na hora. Um **flusher em batch** (intervalo no
servidor) drena a fila, faz `createMany` dos cliques e soma os totais por link
numa transação. Resultado: o redirect é rápido e o banco recebe escrita
agregada, não uma transação por clique. O efeito colateral é que o painel é
**eventualmente consistente** — há um atraso de poucos segundos até o flush.

**Cache de lookup no Redis.** O destino de cada slug fica cacheado (TTL
respeitando a expiração do link). Slugs inexistentes também são cacheados por
pouco tempo (sentinela negativa), para um scan de slugs aleatórios não martelar
o Postgres com 404s. Há um teste que deleta o link do banco e mostra o redirect
ainda funcionando pelo cache.

**Senha de link.** Guardada com argon2id. O `GET /:slug` de um link protegido
responde 401; o cliente troca a senha por destino no `POST /:slug/unlock`, que
devolve a URL (e conta o acesso).

**Validação de URL.** Só `http`/`https`, com host plausível; bloqueio explícito
de `javascript:`, `data:`, `file:` e afins. Como o serviço só **redireciona**
(nunca busca a URL no servidor), não há vetor de SSRF aqui — a validação é contra
redirects maliciosos, não contra fetch interno.

## Estrutura

```
src/
  modules/
    links/   criação, redirect, unlock, cache e estatísticas
    cliques/ fila no Redis e flusher em batch
  shared/
    erros/   hierarquia de erro da aplicação
    hash/    argon2id
    http/    erro central
    slug/    gerador base62 + blocklist
    url/     validação da URL de destino
    redis/   client
    prisma/  client
    openapi/ documento gerado dos schemas zod
  app.ts     monta o Fastify (testável via inject)
  server.ts  sobe a porta e roda o flusher periódico
prisma/      schema + migrations
tests/       integração (app.inject)
```

## Segurança — checklist

- **Validação de URL** server-side: só http/https, bloqueia esquemas perigosos.
- **Slug customizado** validado por formato + blocklist de reservados (não colide com rotas).
- **Senha de link com argon2id**, nunca em texto puro.
- **Rate limit** na criação de link.
- **Segredos em `.env`** (`DATABASE_URL`, `REDIS_URL`), com `.env.example` versionado e `.env` no `.gitignore`.
- **Cabeçalhos de segurança** com helmet (CSP afrouxada só no `/docs`).
- **Zero SQL concatenado** — Prisma parametriza tudo; a única query crua (agregação por dia) usa `Prisma.sql` com parâmetros.

## Backup

O que precisa de backup é o Postgres (links e cliques). O Redis guarda só cache
e a fila de cliques ainda não persistida — no pior caso, um crash perde os
poucos segundos de cliques que ainda não foram para o banco.

```bash
docker exec encurtador-postgres pg_dump -U encurtador -d encurtador -F c -f /tmp/encurtador.dump
docker cp encurtador-postgres:/tmp/encurtador.dump ./backups/encurtador-$(date +%F).dump
```

Restaurar:

```bash
docker exec -i encurtador-postgres pg_restore -U encurtador -d encurtador --clean /tmp/encurtador.dump
```

Em produção eu rodaria isso num cron diário com retenção e cópia para storage
externo. Se a janela de perda de cliques precisar ser menor, ligo persistência
AOF no Redis e/ou reduzo o intervalo do flusher.
