import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import { Pool } from 'pg';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
let instance: Db | null = null;

/**
 * Боевой драйвер — HTTP до Neon: он не держит соединение, а на бессерверном
 * Vercel обычный пул соединений быстро упирается в лимиты. Локальная база
 * по HTTP не отвечает, поэтому для localhost берётся обычный клиент —
 * это позволяет крутить проект на машине без интернета.
 *
 * Подключение создаётся при первом запросе, а не при импорте: иначе
 * `next build` падает там, где переменная окружения не задана.
 */
function getDb(): Db {
  if (instance) return instance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Не задан DATABASE_URL. Скопируй .env.example в .env.local и вставь строку из Neon.');
  }

  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  instance = isLocal
    // Локальный движок обслуживает одно соединение за раз, а страницы шлют
    // запросы парами через Promise.all — поэтому пул ограничен единицей.
    // На Neon это ограничение не нужно и не ставится.
    ? (drizzlePg(new Pool({ connectionString: url, max: 1 }), { schema }) as unknown as Db)
    : (drizzleHttp(neon(url), { schema }) as unknown as Db);

  return instance;
}

export const db = new Proxy({} as Db, {
  get: (_t, prop: keyof Db) => getDb()[prop],
});

export * from './schema';
