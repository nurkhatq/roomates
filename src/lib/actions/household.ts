'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, households, householdPhotos, members, memberPhotos, purchases, purchaseShares } from '@/db';
import { sharesEqual } from '@/lib/money';
import { guard } from './guard';

export type FormState = { error?: string; ok?: boolean };

/**
 * Потолок на случай, если сжатие на телефоне не сработало. Раньше он был
 * 400 000 и аватарка в PNG на 380 КБ в него не влезала — а действие при этом
 * молча ничего не делало. Теперь и запас больше, и о превышении сообщаем.
 */
const MAX_PHOTO_BYTES = 700_000;

const str = (v: FormDataEntryValue | null) => String(v ?? '').trim();
const int = (v: FormDataEntryValue | null) => {
  const n = Math.round(Number(String(v ?? '').trim()));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export async function updateHousehold(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await guard();

  const name = str(form.get('name'));
  if (!name) return { error: 'Название не может быть пустым' };

  const dayRaw = str(form.get('rentDay'));
  const day = dayRaw === '' ? null : Math.min(31, Math.max(1, Math.round(Number(dayRaw) || 1)));

  await db.update(households).set({
    name,
    address: str(form.get('address')),
    mapUrl: str(form.get('mapUrl')),
    entrance: str(form.get('entrance')),
    apartment: str(form.get('apartment')),
    floor: str(form.get('floor')),
    rentAmount: int(form.get('rentAmount')),
    rentDay: day,
    utilitiesAmount: int(form.get('utilitiesAmount')),
  }).where(eq(households.id, s.household.id));

  revalidatePath('/dom');
  revalidatePath('/zakup');
  return { ok: true };
}

const PHOTO_TOO_BIG = 'Фото слишком тяжёлое — попробуй снять ещё раз';

function splitDataUrl(dataUrl: string): { data: string; mime: string } | null {
  if (!dataUrl.startsWith('data:image/')) return null;
  const comma = dataUrl.indexOf(',');
  const semi = dataUrl.indexOf(';');
  if (comma < 0 || semi < 0) return null;
  const data = dataUrl.slice(comma + 1);
  if (data.length > MAX_PHOTO_BYTES) return null;
  return { data, mime: dataUrl.slice(5, semi) };
}

export async function setHouseholdPhoto(dataUrl: string): Promise<string | void> {
  const s = await guard();
  const parsed = splitDataUrl(dataUrl);
  if (!parsed) return PHOTO_TOO_BIG;

  await db.insert(householdPhotos)
    .values({ householdId: s.household.id, ...parsed, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: householdPhotos.householdId,
      set: { ...parsed, updatedAt: new Date() },
    });
  revalidatePath('/dom');
}

/** Аватарку каждый ставит себе сам — чужую трогать незачем. */
export async function setMyPhoto(dataUrl: string): Promise<string | void> {
  const s = await guard();
  const parsed = splitDataUrl(dataUrl);
  if (!parsed) return PHOTO_TOO_BIG;

  await db.insert(memberPhotos)
    .values({ memberId: s.member.id, ...parsed, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: memberPhotos.memberId,
      set: { ...parsed, updatedAt: new Date() },
    });
  revalidatePath('/ya');
}

export async function updateMyName(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await guard();
  const name = str(form.get('name'));
  if (!name) return { error: 'Имя не может быть пустым' };

  await db.update(members).set({ name }).where(eq(members.id, s.member.id));
  revalidatePath('/ya');
  return { ok: true };
}

/**
 * Записать аренду закупом. Автоматически это делать не стоит: сумма и месяц
 * бывают разные, а тихо созданный долг на 70 тысяч — плохой сюрприз.
 */
export async function recordRent(): Promise<void> {
  const s = await guard();
  const amount = s.household.rentAmount;
  if (!amount || amount <= 0) return;

  const everyone = s.roommates.map((m) => m.id);
  const shares = sharesEqual(amount, everyone);

  const [row] = await db.insert(purchases).values({
    householdId: s.household.id, kind: 'purchase', payerId: s.member.id,
    total: amount, note: 'Аренда', createdBy: s.member.id,
  }).returning({ id: purchases.id });

  await db.insert(purchaseShares).values(
    shares.map((sh) => ({ purchaseId: row.id, memberId: sh.userId, amount: sh.amount })),
  );

  revalidatePath('/zakup');
  revalidatePath('/dom');
}
