import { criarApp } from './app.js';
import { config } from './config/env.js';
import { persistirCliquesPendentes } from './modules/cliques/flusher.js';

const INTERVALO_FLUSH_MS = 5000;

const app = await criarApp();

try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
  console.info(`Encurtador no ar em ${config.BASE_URL}`);

  setInterval(() => {
    persistirCliquesPendentes().catch((erro) => {
      console.error('Falha ao persistir cliques pendentes:', erro);
    });
  }, INTERVALO_FLUSH_MS);
} catch (erro) {
  console.error('Não consegui subir o servidor:', erro);
  process.exit(1);
}
