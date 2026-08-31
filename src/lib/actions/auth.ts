'use server';

import { eq, and, isNull, asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, households, members } from '@/db';
import { startSession, endSession, newInviteCode } from '@/lib/session';
import { t } from '@/lib/strings';

export type FormState = { error?: string };

const clean = (v: FormDataEntryValue | null) => String(v ?? '').trim();

export async function enterByCode(_prev: FormState, form: FormData): Promise<FormState> {
  const code = clean(form.get('code')).toUpperCase();
  if (!code) return { error: t.join.badCode };
  const found = await db.select({ id: households.id }).from(households)
    .where(eq(households.inviteCode, code)).limit(1);
  if (!found.length) return { error: t.join.badCode };
  redirect(`/join/${code}`);
}

export async function createHousehold(_prev: FormState, form: FormData): Promise<FormState> {
  const houseName = clean(form.get('houseName'));
  const yourName = clean(form.get('yourName'));
  if (!houseName || !yourName) return { error: t.join.emptyName };

  const code = newInviteCode();
  const [house] = await db.insert(households)
    .values({ name: houseName, inviteCode: code }).returning();
  const [me] = await db.insert(members)
    .values({ householdId: house.id, name: yourName, color: '--p1' }).returning();

  await startSession(me.id);
  redirect('/zakup');
}

export async function joinAs(memberId: string): Promise<void> {
  const found = await db.select({ id: members.id, leftAt: members.leftAt })
    .from(members).where(eq(members.id, memberId)).limit(1);
  if (!found.length || found[0].leftAt) redirect('/');
  await startSession(memberId);
  redirect('/zakup');
}

export async function addSelfAndJoin(_prev: FormState, form: FormData): Promise<FormState> {
  const code = clean(form.get('code')).toUpperCase();
  const name = clean(form.get('name'));
  if (!name) return { error: t.join.emptyName };

  const [house] = await db.select().from(households)
    .where(eq(households.inviteCode, code)).limit(1);
  if (!house) return { error: t.join.badCode };

  const existing = await db.select({ id: members.id, name: members.name }).from(members)
    .where(and(eq(members.householdId, house.id), isNull(members.leftAt))).orderBy(asc(members.createdAt));
  if (existing.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
    return { error: t.join.nameTaken };
  }

  const [me] = await db.insert(members)
    .values({ householdId: house.id, name, color: `--p${(existing.length % 4) + 1}` }).returning();
  await startSession(me.id);
  redirect('/zakup');
}

export async function leaveSession(): Promise<void> {
  await endSession();
  redirect('/');
}
