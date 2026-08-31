'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, purchases, purchaseShares, purchaseItems, purchasePhotos, items, stockEvents } from '@/db';
import { sharesEqual, type Share } from '@/lib/money';
import { guard, assertOurs, assertMember } from './guard';
import { canDeletePurchase, canConfirmSettlement } from '@/lib/rights';
import { momentFor } from '@/lib/time';
import { t } from '@/lib/strings';

export type FormState = { error?: string; ok?: boolean };

export async function addPurchase(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await guard();

  const total = Math.round(Number(form.get('total')));
  if (!Number.isFinite(total) || total <= 0) return { error: t.money.needAmount };

  const payerId = String(form.get('payerId') ?? '');
  assertMember(payerId, s);

  const participants = form.getAll('participants').map(String);
  if (participants.length === 0) return { error: t.money.needParticipants };
  participants.forEach((id) => assertMember(id, s));

  /*
   * Поровну — не всегда правильно. Заказали еду, у каждого своя позиция:
   * один взял на 1 800, другой на 4 200. Тогда доли приходят готовыми, и
   * сумма долей обязана сойтись с общей суммой до тенге — иначе баланс
   * квартиры уедет и уже никогда не сойдётся в ноль.
   */
  let custom: Share[] | null = null;
  if (String(form.get('splitMode') ?? '') === 'custom') {
    try {
      const parsed: unknown = JSON.parse(String(form.get('shares') ?? '[]'));
      if (!Array.isArray(parsed)) throw new Error('не список');
      custom = parsed
        .map((x) => x as { memberId?: unknown; amount?: unknown })
        .map((x) => ({ userId: String(x.memberId ?? ''), amount: Math.round(Number(x.amount) || 0) }))
        .filter((x) => x.userId && x.amount > 0);
    } catch {
      return { error: t.money.badShares };
    }
    custom.forEach((x) => assertMember(x.userId, s));
    if (custom.length === 0) return { error: t.money.needParticipants };

    const sum = custom.reduce((a, x) => a + x.amount, 0);
    if (sum !== total) return { error: `${t.money.sharesMismatch} ${total - sum > 0 ? '+' : ''}${total - sum}` };
  }

  const note = String(form.get('note') ?? '').trim();
  const dateRaw = String(form.get('date') ?? '');
  // Дата считается по Астане, а не по серверу: иначе вечерний закуп
  // записывался бы вчерашним днём.
  const boughtAt = dateRaw ? momentFor(dateRaw) : new Date();

  // Что именно взяли с полки. Пустой список — обычный закуп без разбора.
  let lines: { itemId: string; qty: number; amount: number }[] = [];
  try {
    const raw = String(form.get('lines') ?? '[]');
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      lines = parsed
        .map((l) => l as { itemId?: unknown; qty?: unknown; amount?: unknown })
        .map((l) => ({
          itemId: String(l.itemId ?? ''),
          qty: Number(l.qty),
          amount: Math.max(0, Math.round(Number(l.amount) || 0)),
        }))
        .filter((l) => l.itemId && Number.isFinite(l.qty) && l.qty > 0);
    }
  } catch {
    lines = []; // битый список не должен ронять сам закуп
  }

  // Вещи должны быть из этой же квартиры — id приходит с клиента.
  if (lines.length) {
    const ids = [...new Set(lines.map((l) => l.itemId))];
    const owned = await db.select({ id: items.id, householdId: items.householdId })
      .from(items).where(inArray(items.id, ids));
    const ours = new Set(owned.filter((o) => o.householdId === s.household.id).map((o) => o.id));
    lines = lines.filter((l) => ours.has(l.itemId));
  }

  const shares = custom ?? sharesEqual(total, participants);

  const [row] = await db.insert(purchases).values({
    householdId: s.household.id, kind: 'purchase', payerId, total, note,
    boughtAt, createdBy: s.member.id,
  }).returning({ id: purchases.id });

  await db.insert(purchaseShares).values(
    shares.map((sh) => ({ purchaseId: row.id, memberId: sh.userId, amount: sh.amount })),
  );

  if (lines.length) {
    await db.insert(purchaseItems).values(
      lines.map((l) => ({ purchaseId: row.id, itemId: l.itemId, qty: l.qty, amount: l.amount })),
    );

    // Закуп сразу пополняет остаток — иначе после магазина пришлось бы
    // отдельно заходить в каждую вещь и вписывать то же самое второй раз.
    await db.insert(stockEvents).values(
      lines.map((l) => ({
        itemId: l.itemId, kind: 'purchase' as const, qty: l.qty,
        at: boughtAt, memberId: s.member.id,
      })),
    );

    // Цена запоминается с последнего закупа, где её указали.
    for (const l of lines) {
      if (l.amount > 0 && l.qty > 0) {
        await db.update(items).set({ price: Math.round(l.amount / l.qty) })
          .where(eq(items.id, l.itemId));
      }
    }
  }

  revalidatePath('/zakup');
  revalidatePath('/veshi');
  return { ok: true };
}

/**
 * Погашение долга: тот же перевод денег, просто с одним участником.
 *
 * Подтвердить перевод может только получатель — деньги пришли ему. Проверка
 * обязана быть здесь, а не только в кнопке: серверное действие вызывается
 * напрямую, и прятать кнопку — не защита.
 */
export async function recordSettlement(fromId: string, toId: string, amount: number): Promise<void> {
  const s = await guard();
  assertMember(fromId, s);
  assertMember(toId, s);
  if (!canConfirmSettlement(toId, s.member.id)) {
    throw new Error('Отметить перевод может только тот, кому переводят');
  }
  if (fromId === toId) throw new Error('Перевод самому себе ничего не значит');
  if (!Number.isFinite(amount) || amount <= 0) return;

  const [row] = await db.insert(purchases).values({
    householdId: s.household.id, kind: 'settlement', payerId: fromId,
    total: Math.round(amount), note: '', createdBy: s.member.id,
  }).returning({ id: purchases.id });

  await db.insert(purchaseShares).values({ purchaseId: row.id, memberId: toId, amount: Math.round(amount) });
  revalidatePath('/zakup');
}

/**
 * Удалить запись может только тот, кого она касается.
 *
 * Закуп — заплативший или тот, кто его записал: свою опечатку человек должен
 * уметь исправить. Перевод — только две его стороны: иначе посторонний жилец
 * отменяет чужое подтверждение оплаты, и долг воскресает.
 */
/** Потолок на случай, если сжатие на телефоне не сработало. */
const MAX_PHOTO_BYTES = 900_000;

/**
 * Чек прикрепляет тот, кого запись касается — по тому же правилу, что и
 * удаление: посторонний не должен подменять чужую бумажку.
 */
export async function setPurchasePhoto(id: string, dataUrl: string): Promise<string | void> {
  const s = await guard();

  const [row] = await db.select({
    householdId: purchases.householdId, kind: purchases.kind,
    payerId: purchases.payerId, createdBy: purchases.createdBy,
  }).from(purchases).where(eq(purchases.id, id)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);
  if (!canDeletePurchase(row, [], s.member.id)) {
    throw new Error('Прикрепить чек может только тот, кого запись касается');
  }

  if (!dataUrl.startsWith('data:image/')) return 'Это не похоже на картинку';
  const comma = dataUrl.indexOf(',');
  const data = dataUrl.slice(comma + 1);
  const mime = dataUrl.slice(5, dataUrl.indexOf(';'));
  if (data.length > MAX_PHOTO_BYTES) return 'Чек слишком тяжёлый — сними ещё раз';

  await db.insert(purchasePhotos)
    .values({ purchaseId: id, data, mime, updatedAt: new Date() })
    .onConflictDoUpdate({ target: purchasePhotos.purchaseId, set: { data, mime, updatedAt: new Date() } });

  revalidatePath('/zakup');
}

export async function deletePurchase(id: string): Promise<void> {
  const s = await guard();

  const [row] = await db.select({
    householdId: purchases.householdId, kind: purchases.kind,
    payerId: purchases.payerId, createdBy: purchases.createdBy,
  }).from(purchases).where(eq(purchases.id, id)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);

  const parties = row.kind === 'settlement'
    ? (await db.select({ memberId: purchaseShares.memberId })
        .from(purchaseShares).where(eq(purchaseShares.purchaseId, id))).map((p) => p.memberId)
    : [];
  if (!canDeletePurchase(row, parties, s.member.id)) {
    throw new Error('Эту запись может удалить только тот, кого она касается');
  }

  await db.delete(purchases).where(eq(purchases.id, id));
  revalidatePath('/zakup');
}

