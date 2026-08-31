'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, purchases, purchaseShares } from '@/db';
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

  const shares = sharesEqual(total, participants);

  const [row] = await db.insert(purchases).values({
    householdId: s.household.id, kind: 'purchase', payerId, total, note,
    boughtAt, createdBy: s.member.id,
  }).returning({ id: purchases.id });

  await db.insert(purchaseShares).values(
    shares.map((sh) => ({ purchaseId: row.id, memberId: sh.userId, amount: sh.amount })),
  );

  revalidatePath('/zakup');
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
