import { eq } from 'drizzle-orm';
import { db, itemPhotos, memberPhotos, householdPhotos, purchasePhotos } from '@/db';

/**
 * Фото отдаются отдельно от списков и кэшируются надолго: ссылка содержит
 * версию, поэтому после замены картинки браузер сходит за новой сам.
 */
const TABLES = {
  item: { table: itemPhotos, key: itemPhotos.itemId },
  member: { table: memberPhotos, key: memberPhotos.memberId },
  house: { table: householdPhotos, key: householdPhotos.householdId },
  receipt: { table: purchasePhotos, key: purchasePhotos.purchaseId },
} as const;

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  const spec = TABLES[kind as keyof typeof TABLES];
  if (!spec) return new Response(null, { status: 404 });

  const [row] = await db.select().from(spec.table).where(eq(spec.key, id)).limit(1);
  if (!row) return new Response(null, { status: 404 });

  const bytes = Buffer.from(row.data, 'base64');
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': row.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Length': String(bytes.byteLength),
    },
  });
}
