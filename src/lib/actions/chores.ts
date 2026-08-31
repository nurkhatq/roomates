'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, chores, choreEvents } from '@/db';
import { guard, assertOurs, assertMember } from './guard';

export type FormState = { error?: string; ok?: boolean };

export async function addChore(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await guard();

  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: 'Впиши название' };

  const periodDays = Math.max(1, Math.round(Number(form.get('periodDays')) || 7));
  const order = form.getAll('order').map(String);
  order.forEach((id) => assertMember(id, s));

  await db.insert(chores).values({
    householdId: s.household.id, name, periodDays,
    order: order.length ? order : s.roommates.map((m) => m.id),
  });

  revalidatePath('/dezhurstva');
  return { ok: true };
}

export async function markChoreDone(choreId: string, memberId: string): Promise<void> {
  const s = await guard();
  assertMember(memberId, s);

  const [row] = await db.select({ householdId: chores.householdId })
    .from(chores).where(eq(chores.id, choreId)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);

  await db.insert(choreEvents).values({ choreId, memberId });
  revalidatePath('/dezhurstva');
}

export async function archiveChore(choreId: string): Promise<void> {
  const s = await guard();
  const [row] = await db.select({ householdId: chores.householdId })
    .from(chores).where(eq(chores.id, choreId)).limit(1);
  if (!row) return;
  assertOurs(row.householdId, s);
  await db.update(chores).set({ archivedAt: new Date() }).where(eq(chores.id, choreId));
  revalidatePath('/dezhurstva');
}
