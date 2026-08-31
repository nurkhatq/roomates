/**
 * Когда следующий платёж за аренду. День месяца задаётся в настройках
 * квартиры; если он уже прошёл — считаем следующий месяц.
 */
export type RentDue = { date: Date; daysLeft: number } | null;

const DAY = 86_400_000;

export function nextRentDate(day: number | null, now: Date = new Date()): RentDue {
  if (!day || day < 1 || day > 31) return null;

  const atDay = (y: number, m: number) => {
    // В коротком месяце 31-е число превращается в последний день месяца,
    // иначе платёж уехал бы на март.
    const last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(day, last));
  };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date = atDay(now.getFullYear(), now.getMonth());
  if (date.getTime() < today.getTime()) date = atDay(now.getFullYear(), now.getMonth() + 1);

  return { date, daysLeft: Math.round((date.getTime() - today.getTime()) / DAY) };
}
