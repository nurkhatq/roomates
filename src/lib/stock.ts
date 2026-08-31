/**
 * Предсказание расхода вещей.
 *
 * Идея: система не спрашивает каждый день. Ты ставишь первый срок сам («блок
 * бумаги кончится примерно за неделю»), а после первой же пересчитанной проверки
 * система знает реальный расход и дальше назначает срок сама — ближе к тому
 * моменту, когда вещь реально подходит к концу.
 */

export type StockEvent =
  /** Закупили: добавили qty штук. */
  | { kind: 'purchase'; qty: number; at: Date }
  /** Пересчитали: осталось ровно qty штук. Это истина, она перебивает расчёт. */
  | { kind: 'check'; qty: number; at: Date };

export type StockState = {
  /** Сколько сейчас по нашим данным. null — ни одного события. */
  current: number | null;
  /** Расход в день. null — ещё не из чего посчитать. */
  ratePerDay: number | null;
  /** Дней до нуля при текущем расходе. */
  daysLeft: number | null;
  /** Когда кончится. */
  runsOutOn: Date | null;
  /** Когда просить пересчитать. */
  nextCheckOn: Date | null;
  /** Насколько можно верить расходу. */
  confidence: 'none' | 'rough' | 'good';
  /** Пересчёты, где расход вышел отрицательным — значит закупку не записали. */
  unloggedPurchases: number;
  /** Сколько считается полным запасом: самая большая разовая закупка. */
  capacity: number | null;
  /** Насколько полно сейчас, от 0 до 1. Для полоски на карточке. */
  level: number | null;
};

const DAY = 86_400_000;
const days = (a: Date, b: Date) => (b.getTime() - a.getTime()) / DAY;

/** Доля от типичной закупки, ниже которой пора пересчитывать. */
const LOW = 0.3;
/** Не дёргать чаще, чем раз в двое суток, даже если расход бешеный. */
const MIN_GAP_DAYS = 2;

export function stockState(
  events: StockEvent[],
  checkIntervalDays: number,
  now: Date = new Date(),
): StockState {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  if (sorted.length === 0) {
    return { current: null, ratePerDay: null, daysLeft: null, runsOutOn: null,
             nextCheckOn: null, confidence: 'none', unloggedPurchases: 0,
             capacity: null, level: null };
  }

  // Проходим по событиям, собирая замеры расхода между соседними пересчётами.
  const samples: { rate: number; at: Date }[] = [];
  let unlogged = 0;
  let prevCheck: { qty: number; at: Date } | null = null;
  let boughtSincePrevCheck = 0;

  for (const e of sorted) {
    if (e.kind === 'purchase') {
      boughtSincePrevCheck += e.qty;
      continue;
    }
    if (prevCheck) {
      const span = days(prevCheck.at, e.at);
      const consumed = prevCheck.qty + boughtSincePrevCheck - e.qty;
      if (span > 0) {
        if (consumed < 0) unlogged++; // остаток вырос — закупку не записали, замер выкидываем
        else samples.push({ rate: consumed / span, at: e.at });
      }
    }
    prevCheck = { qty: e.qty, at: e.at };
    boughtSincePrevCheck = 0;
  }

  // Текущий остаток: последняя правда плюс всё, что купили после неё.
  const lastCheck = prevCheck;
  const current = lastCheck
    ? lastCheck.qty + boughtSincePrevCheck
    : sorted.reduce((a, e) => a + (e.kind === 'purchase' ? e.qty : 0), 0);

  // Расход: среднее по трём последним замерам, свежие весят больше.
  let ratePerDay: number | null = null;
  if (samples.length) {
    const last = samples.slice(-3);
    let num = 0;
    let den = 0;
    last.forEach((s, i) => {
      const w = i + 1;
      num += s.rate * w;
      den += w;
    });
    ratePerDay = num / den;
  }

  const confidence: StockState['confidence'] =
    samples.length === 0 ? 'none' : samples.length === 1 ? 'rough' : 'good';

  // Полным запасом считаем самую большую разовую закупку: сколько берут за раз,
  // столько и есть «полка забита». Первый закуп задаёт эту величину сам.
  const purchases = sorted.filter(
    (e): e is Extract<StockEvent, { kind: 'purchase' }> => e.kind === 'purchase',
  );
  const capacity = purchases.length ? Math.max(...purchases.map((e) => e.qty)) : null;
  const level = capacity && capacity > 0 ? Math.max(0, Math.min(1, current / capacity)) : null;

  const daysLeft = ratePerDay && ratePerDay > 0 ? current / ratePerDay : null;
  const runsOutOn = daysLeft === null ? null : new Date(now.getTime() + daysLeft * DAY);

  // Когда просить пересчёт.
  const lastEventAt = sorted[sorted.length - 1].at;
  const fallback = new Date(lastEventAt.getTime() + checkIntervalDays * DAY);
  let nextCheckOn = fallback;
  if (ratePerDay && ratePerDay > 0) {
    const typicalPack = Math.max(1, capacity ?? 1);
    const lowAt = Math.max(0, current - typicalPack * LOW) / ratePerDay; // дней до «мало»
    const proposed = new Date(now.getTime() + lowAt * DAY);
    const floor = new Date(now.getTime() + MIN_GAP_DAYS * DAY);
    nextCheckOn = new Date(Math.min(Math.max(proposed.getTime(), floor.getTime()), fallback.getTime()));
  }

  return { current, ratePerDay, daysLeft, runsOutOn, nextCheckOn, confidence,
           unloggedPurchases: unlogged, capacity, level };
}

/** Пора ли просить пересчёт. */
export const checkDue = (s: StockState, now: Date = new Date()) =>
  s.nextCheckOn !== null && now.getTime() >= s.nextCheckOn.getTime();

/**
 * Пора ли закупаться. Расход известен — смотрим, кончится ли на днях.
 * Расхода ещё нет — смотрим на остаток: пусто или меньше трети пачки.
 */
export function buySoon(s: StockState, leadDays = 3): boolean {
  if (s.daysLeft !== null) return s.daysLeft <= leadDays;
  if (s.current === null) return false;
  if (s.current <= 0) return true;
  return s.level !== null && s.level <= LOW;
}
