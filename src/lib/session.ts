import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { eq, and, isNull, gt, asc, sql, getTableColumns } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db, sessions, members, households, memberPhotos } from '@/db';

const COOKIE = 'hata_sid';
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** Жилец плюс версия его аватарки — она нужна на каждом экране, где есть люди. */
export type Mate = typeof members.$inferSelect & { photoVersion: number };

export type Session = {
  member: Mate;
  household: typeof households.$inferSelect;
  /** Все жильцы квартиры, в порядке заселения — от него зависят цвета. */
  roommates: Mate[];
};

/** Читается много раз за рендер одной страницы — кэшируем на запрос. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ member: members, household: households })
    .from(sessions)
    .innerJoin(members, eq(members.id, sessions.memberId))
    .innerJoin(households, eq(households.id, members.householdId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || row.member.leftAt) return null;

  // Аватарки подтягиваются вместе с жильцами: иначе каждая страница ходила бы
  // за ними отдельно, а люди показываются почти везде.
  const roommates: Mate[] = await db
    .select({
      ...getTableColumns(members),
      photoVersion: sql<number>`coalesce(extract(epoch from ${memberPhotos.updatedAt})::bigint, 0)`,
    })
    .from(members)
    .leftJoin(memberPhotos, eq(memberPhotos.memberId, members.id))
    .where(and(eq(members.householdId, row.household.id), isNull(members.leftAt)))
    .orderBy(asc(members.createdAt));

  const me = roommates.find((m) => m.id === row.member.id)
    ?? { ...row.member, photoVersion: 0 };

  return { member: me, household: row.household, roommates };
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/');
  return s;
}

export async function startSession(memberId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + YEAR_MS);
  await db.insert(sessions).values({ token, memberId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.token, token));
  jar.delete(COOKIE);
}

/** Код квартиры без похожих друг на друга букв — его диктуют вслух. */
export function newInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
