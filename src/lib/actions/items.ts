'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, items, itemPhotos, stockEvents } from '@/db';
import { guard, assertOurs, assertMember } from './guard';

export type FormState = { error?: string; ok?: boolean };

/** Фото режется на телефоне до 512px WebP; это потолок на случай, если что-то пошло не так. */
const MAX_PHOTO_BYTES = 400_000;

export async function addItem(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await guard();

  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: 'Впиши название' };

  const unit = String(form.get('unit') ?? 'шт').trim() || 'шт';
  const interval = Math.max(1, Math.round(Number(form.get('interval')) || 7));

  const ownerRaw = String(form.get('ownerId') ?? '');
  const ownerId = ownerRaw === '' ? null : ownerRaw;
  if (ownerId) assertMember(ownerId, s);

  const [row] = await db.insert(items).values({
    householdId: s.household.id, ownerId, name, unit, checkIntervalDays: interval,
  }).returning({ id: items.id });

  const photo = String(form.get('photo') ?? '');
  if (photo.startsWith('data:image/')) {
    const comma = photo.indexOf(',');
    const data = photo.slice(comma + 1);
    const mime = photo.slice(5, photo.indexOf(';'));
    if (data.length <= MAX_PHOTO_BYTES) {
      await db.insert(itemPhotos).values({ itemId: row.id, data, mime });
    }
  }

  const qty = Number(form.get('qty'));
  if (Number.isFinite(qty) && qty > 0) {
    await db.insert(stockEvents).values({
      itemId: row.id, kind: 'purchase', qty, memberId: s.member.id,
    });
  }

  revalidatePath('/veshi');
  return { ok: true };
}

/** Заменить или добавить фото уже существующей вещи. */
export async function setItemPhoto(itemId: string, dataUrl: string): Promise<void> {
  const s = await guard();

  const [row] = await db.select({ householdId: items.householdId })
    .from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);

  if (!dataUrl.startsWith('data:image/')) return;
  const comma = dataUrl.indexOf(',');
  const data = dataUrl.slice(comma + 1);
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  if (data.length > MAX_PHOTO_BYTES) return;

  await db.insert(itemPhotos).values({ itemId, data, mime, updatedAt: new Date() })
    .onConflictDoUpdate({ target: itemPhotos.itemId, set: { data, mime, updatedAt: new Date() } });

  revalidatePath('/veshi');
}

export async function recordStock(itemId: string, kind: 'purchase' | 'check', qty: number): Promise<void> {
  const s = await guard();
  if (!Number.isFinite(qty) || qty < 0) return;

  const [row] = await db.select({ householdId: items.householdId })
    .from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);

  await db.insert(stockEvents).values({ itemId, kind, qty, memberId: s.member.id });
  revalidatePath('/veshi');
}

export async function archiveItem(itemId: string): Promise<void> {
  const s = await guard();
  const [row] = await db.select({ householdId: items.householdId })
    .from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);
  await db.update(items).set({ archivedAt: new Date() }).where(eq(items.id, itemId));
  revalidatePath('/veshi');
}
