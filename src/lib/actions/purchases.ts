'use server';

import { eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, purchases, purchaseShares, purchaseItems, items, stockEvents } from '@/db';
import { sharesEqual } from '@/lib/money';
import { guard, assertOurs, assertMember } from './guard';
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

  const note = String(form.get('note') ?? '').trim();
  const dateRaw = String(form.get('date') ?? '');
  const boughtAt = dateRaw ? new Date(`${dateRaw}T12:00:00`) : new Date();

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

  const shares = sharesEqual(total, participants);

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

/** Погашение долга: тот же перевод денег, просто с одним участником. */
export async function recordSettlement(fromId: string, toId: string, amount: number): Promise<void> {
  const s = await guard();
  assertMember(fromId, s);
  assertMember(toId, s);
  if (!Number.isFinite(amount) || amount <= 0) return;

  const [row] = await db.insert(purchases).values({
    householdId: s.household.id, kind: 'settlement', payerId: fromId,
    total: Math.round(amount), note: '', createdBy: s.member.id,
  }).returning({ id: purchases.id });

  await db.insert(purchaseShares).values({ purchaseId: row.id, memberId: toId, amount: Math.round(amount) });
  revalidatePath('/zakup');
}

export async function deletePurchase(id: string): Promise<void> {
  const s = await guard();
  const [row] = await db.select({ householdId: purchases.householdId })
    .from(purchases).where(eq(purchases.id, id)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);
  await db.delete(purchases).where(eq(purchases.id, id));
  revalidatePath('/zakup');
}
