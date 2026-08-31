'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db, members } from '@/db';
import { hashPassword, verifyPassword, passwordProblem } from '@/lib/password';
import { guard } from './guard';
import { t } from '@/lib/strings';

export type FormState = { error?: string; ok?: boolean };

/**
 * Поставить или сменить свой пароль.
 *
 * Если пароль уже стоит, нужно назвать текущий: сессия живёт год, и без этого
 * любой, кто взял разблокированный телефон соседа, менял бы пароль на свой.
 */
export async function setMyPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const s = await guard();

  const current = String(form.get('current') ?? '');
  const next = String(form.get('next') ?? '');
  const repeat = String(form.get('repeat') ?? '');

  const [me] = await db.select({ hash: members.passwordHash })
    .from(members).where(eq(members.id, s.member.id)).limit(1);

  if (me?.hash && !verifyPassword(current, me.hash)) {
    return { error: t.me.wrongCurrent };
  }

  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== repeat) return { error: t.me.repeatMismatch };

  await db.update(members).set({ passwordHash: hashPassword(next) })
    .where(eq(members.id, s.member.id));

  revalidatePath('/ya');
  revalidatePath('/zakup');
  return { ok: true };
}
