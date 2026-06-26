import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // Os testes de integração compartilham Postgres e Redis; rodar arquivos em
    // paralelo geraria corrida na limpeza entre eles.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      BASE_URL: 'http://localhost:3335',
      DATABASE_URL:
        'postgresql://encurtador:encurtador@localhost:5435/encurtador_test?schema=public',
      REDIS_URL: 'redis://localhost:6381',
    },
  },
});
