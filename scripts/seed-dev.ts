/**
 * Тестовая квартира для локальной разработки. Только для localhost — на боевой
 * базе скрипт откажется работать, чтобы никто случайно не насыпал туда мусора.
 */
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from '../src/db/schema';

const CODE = 'TEST01';

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    console.error('Этот скрипт работает только с локальной базой. Проверь DATABASE_URL.');
    process.exit(1);
  }

  const db = drizzle(new Pool({ connectionString: url }), { schema });

  const existing = await db.select().from(schema.households)
    .where(eq(schema.households.inviteCode, CODE)).limit(1);
  if (existing.length) {
    console.log(`Квартира ${CODE} уже есть.`);
    process.exit(0);
  }

  const [house] = await db.insert(schema.households)
    .values({ name: 'Хата на Абая', inviteCode: CODE }).returning();

  for (const [i, name] of ['Нурхат', 'Данияр', 'Асхат', 'Ерлан'].entries()) {
    await db.insert(schema.members)
      .values({ householdId: house.id, name, color: `--p${i + 1}` });
  }

  console.log(`Готово. Заходи на /join/${CODE}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
