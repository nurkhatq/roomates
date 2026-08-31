'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, items, itemPhotos, stockEvents } from '@/db';
import { guard, assertOurs, assertMember } from './guard';
import { canEditItem } from '@/lib/rights';

export type FormState = { error?: string; ok?: boolean };

/** Фото режется на телефоне до 512px WebP; это потолок на случай, если что-то пошло не так. */
const MAX_PHOTO_BYTES = 400_000;

export async function addItem(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await guard();

  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: 'Впиши название' };

  const unit = String(form.get('unit') ?? 'шт').trim() || 'шт';
  const interval = Math.max(1, Math.round(Number(form.get('interval')) || 7));

  const altUnit = String(form.get('altUnit') ?? '').trim() || null;
  const altRaw = String(form.get('altQty') ?? '').trim();
  const altQty = altRaw === '' ? null : Math.max(0, Number(altRaw) || 0) || null;

  const priceRaw = String(form.get('price') ?? '').trim();
  const price = priceRaw === '' ? null : Math.max(0, Math.round(Number(priceRaw) || 0));

  const ownerRaw = String(form.get('ownerId') ?? '');
  const ownerId = ownerRaw === '' ? null : ownerRaw;
  if (ownerId) assertMember(ownerId, s);

  const [row] = await db.insert(items).values({
    householdId: s.household.id, ownerId, name, unit, checkIntervalDays: interval, price,
    altUnit: altQty ? altUnit : null, altQty: altUnit ? altQty : null,
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

  // Тот, кто завёл вещь, её не покупал — он просто пересчитал, что уже стоит
  // дома. Записывать это покупкой значит врать и в ленте действий, и в расходе.
  const qty = Number(form.get('qty'));
  if (Number.isFinite(qty) && qty >= 0) {
    await db.insert(stockEvents).values({
      itemId: row.id, kind: 'check', qty, memberId: s.member.id,
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

/** Правка карточки вещи: название, единица, цена, срок пересчёта. */
export async function updateItem(
  itemId: string,
  patch: { name?: string; unit?: string; price?: number | null;
           altUnit?: string | null; altQty?: number | null; checkIntervalDays?: number },
): Promise<void> {
  const s = await guard();

  const [row] = await db.select({ householdId: items.householdId, ownerId: items.ownerId })
    .from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);
  if (!canEditItem(row.ownerId, s.member.id)) {
    throw new Error('Это личная вещь другого жильца');
  }

  const next: Partial<typeof items.$inferInsert> = {};
  if (patch.name !== undefined && patch.name.trim()) next.name = patch.name.trim();
  if (patch.unit !== undefined && patch.unit.trim()) next.unit = patch.unit.trim();
  if (patch.price !== undefined) next.price = patch.price === null ? null : Math.max(0, Math.round(patch.price));
  if (patch.altQty !== undefined) next.altQty = patch.altQty === null ? null : Math.max(0, patch.altQty) || null;
  if (patch.altUnit !== undefined) next.altUnit = patch.altUnit?.trim() || null;
  if (patch.checkIntervalDays !== undefined) next.checkIntervalDays = Math.max(1, Math.round(patch.checkIntervalDays));
  if (Object.keys(next).length === 0) return;

  await db.update(items).set(next).where(eq(items.id, itemId));
  revalidatePath('/veshi');
}

export async function archiveItem(itemId: string): Promise<void> {
  const s = await guard();
  const [row] = await db.select({ householdId: items.householdId, ownerId: items.ownerId })
    .from(items).where(eq(items.id, itemId)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);
  if (!canEditItem(row.ownerId, s.member.id)) {
    throw new Error('Это личная вещь другого жильца');
  }
  await db.update(items).set({ archivedAt: new Date() }).where(eq(items.id, itemId));
  revalidatePath('/veshi');
}
