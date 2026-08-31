import 'server-only';
import { requireSession, type Session } from '@/lib/session';

/**
 * Здесь лежат деньги и вещи четырёх человек. Каждое действие обязано убедиться,
 * что объект принадлежит квартире того, кто его дёргает — id в форме приходит
 * с клиента и доверять ему нельзя.
 */
export async function guard(): Promise<Session> {
  return requireSession();
}

export function assertOurs(householdId: string, s: Session): void {
  if (householdId !== s.household.id) throw new Error('Это не из твоей квартиры');
}

export function assertMember(memberId: string, s: Session): void {
  if (!s.roommates.some((m) => m.id === memberId)) throw new Error('Такого жильца в квартире нет');
}
