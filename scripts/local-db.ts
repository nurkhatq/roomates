/**
 * Локальная база для разработки без интернета: Postgres поднимается в процессе
 * и выставляется на порт по обычному протоколу. Данные лежат в .localdb/,
 * которая не попадает в репозиторий.
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PORT = Number(process.env.LOCAL_DB_PORT ?? 5433);

async function main() {
  const db = await PGlite.create({ dataDir: '.localdb' });

  const dir = join(process.cwd(), 'drizzle');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    for (const stmt of readFileSync(join(dir, file), 'utf8').split('--> statement-breakpoint')) {
      const s = stmt.trim();
      if (!s) continue;
      try { await db.exec(s); } catch { /* уже накачено — идём дальше */ }
    }
  }

  const server = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
  await server.start();
  console.log(`Локальная база слушает postgresql://postgres@127.0.0.1:${PORT}/postgres`);

  const stop = async () => { await server.stop(); await db.close(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => { console.error(e); process.exit(1); });
