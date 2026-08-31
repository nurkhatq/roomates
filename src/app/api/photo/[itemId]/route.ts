import { eq } from 'drizzle-orm';
import { db, itemPhotos } from '@/db';

/**
 * Фото отдаются отдельно от списка вещей и кэшируются надолго: содержимое
 * привязано к id, а при замене фото меняется updatedAt в строке-версии.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const [row] = await db.select().from(itemPhotos).where(eq(itemPhotos.itemId, itemId)).limit(1);
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
