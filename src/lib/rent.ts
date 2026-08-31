/**
 * Когда следующий платёж за аренду. День месяца задаётся в настройках
 * квартиры; если он уже прошёл — считаем следующий месяц.
 */
import { partsTZ, noonTZ, daysBetween } from './time';

export type RentDue = { date: Date; daysLeft: number } | null;

/**
 * Считаем по календарю Астаны, а не сервера: иначе поздним вечером сервер
 * ещё во вчерашнем дне и до платежа «остаётся» лишний день.
 */
export function nextRentDate(day: number | null, now: Date = new Date()): RentDue {
  if (!day || day < 1 || day > 31) return null;

  const here = partsTZ(now);

  const atDay = (y: number, m1: number) => {
    // В коротком месяце 31-е число становится последним днём месяца,
    // иначе февральский платёж уехал бы на март.
    const last = new Date(Date.UTC(y, m1, 0)).getUTCDate();
    const d = String(Math.min(day, last)).padStart(2, '0');
    return noonTZ(`${y}-${String(m1).padStart(2, '0')}-${d}`);
  };

  let date = atDay(here.year, here.month);
  if (daysBetween(now, date) < 0) {
    const nextMonth = here.month === 12 ? 1 : here.month + 1;
    const nextYear = here.month === 12 ? here.year + 1 : here.year;
    date = atDay(nextYear, nextMonth);
  }

  return { date, daysLeft: daysBetween(now, date) };
}
