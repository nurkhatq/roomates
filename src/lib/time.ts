/**
 * Время квартиры.
 *
 * Сервер на Vercel живёт в UTC, поэтому без явного пояса всё показывалось на
 * пять часов раньше: 07:24 в Астане отрисовывалось как 02:24. Хуже того,
 * «сегодня» у сервера после семи вечера по Астане было ещё вчерашним — из-за
 * этого поздний вечерний закуп попадал в предыдущий день.
 *
 * Казахстан живёт без перевода часов, поэтому смещение постоянное и его можно
 * писать в строку даты. Для показа всё равно используется имя зоны — так
 * правильнее, если правила когда-нибудь изменятся.
 */
export const TZ = 'Asia/Almaty';
const OFFSET = '+05:00';

const opts = (o: Intl.DateTimeFormatOptions) => ({ ...o, timeZone: TZ });

/** «31 авг.» */
export const fmtDay = new Intl.DateTimeFormat('ru-RU', opts({ day: '2-digit', month: 'short' }));
/** «31 августа» */
export const fmtDayLong = new Intl.DateTimeFormat('ru-RU', opts({ day: 'numeric', month: 'long' }));
/** «31 авг., 07:24» */
export const fmtDayTime = new Intl.DateTimeFormat('ru-RU',
  opts({ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }));
/** «август 2026 г.» */
export const fmtMonthYear = new Intl.DateTimeFormat('ru-RU', opts({ month: 'long', year: 'numeric' }));
/** «август» */
export const fmtMonth = new Intl.DateTimeFormat('ru-RU', opts({ month: 'long' }));
/** «пн» */
export const fmtWeekday = new Intl.DateTimeFormat('ru-RU', opts({ weekday: 'short' }));

/** Календарные части даты так, как их видит человек в Астане. */
export function partsTZ(d: Date = new Date()): { year: number; month: number; day: number } {
  const p = new Intl.DateTimeFormat('en-CA', opts({ year: 'numeric', month: '2-digit', day: '2-digit' }))
    .formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Сегодняшняя дата в Астане как YYYY-MM-DD — для полей ввода даты. */
export function todayISO(now: Date = new Date()): string {
  const { year, month, day } = partsTZ(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Дата без времени превращается в полдень по Астане. Полдень, а не полночь:
 * так запись не перескочит на соседний день ни при каком пересчёте поясов.
 */
export function noonTZ(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00${OFFSET}`);
}

/**
 * Момент записи по выбранной дате. Сегодняшняя дата получает настоящее время —
 * иначе закуп, сделанный в семь утра, лежал бы в ленте полднем и путал порядок.
 * Прошедшая дата времени не имеет, поэтому ей достаётся полдень.
 */
export function momentFor(isoDate: string, now: Date = new Date()): Date {
  return isoDate === todayISO(now) ? now : noonTZ(isoDate);
}

/** Сколько целых суток прошло между двумя календарными днями в Астане. */
export function daysBetween(a: Date, b: Date): number {
  const toNum = (d: Date) => { const p = partsTZ(d); return Date.UTC(p.year, p.month - 1, p.day); };
  return Math.round((toNum(b) - toNum(a)) / 86_400_000);
}
