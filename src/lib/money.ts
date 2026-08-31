/** Деньги везде — целые тенге. Копеек в тенге на практике нет, а float даёт расхождения в балансах. */

export type Share = { userId: string; amount: number };

export type Purchase = {
  id: string;
  payerId: string;
  total: number;
  shares: Share[];
};

export type Transfer = { from: string; to: string; amount: number };

/**
 * Делит сумму на n равных частей так, чтобы сумма частей точно равнялась исходной.
 * Остаток от деления раздаётся по одному тенге первым участникам — иначе
 * 18130 на четверых даёт 4532.5, и баланс никогда не сойдётся в ноль.
 */
export function splitEqual(total: number, n: number): number[] {
  if (n <= 0) throw new Error('Нужен хотя бы один участник');
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / n);
  const rest = abs - base * n;
  return Array.from({ length: n }, (_, i) => sign * (base + (i < rest ? 1 : 0)));
}

/** Раскладывает покупку поровну на выбранных участников. */
export function sharesEqual(total: number, userIds: string[]): Share[] {
  const parts = splitEqual(total, userIds.length);
  return userIds.map((userId, i) => ({ userId, amount: parts[i] }));
}

/**
 * Баланс каждого: сколько он заплатил минус сколько ему насчитали.
 * Плюс — ему должны, минус — должен он. Сумма всех балансов всегда ноль.
 */
export function balances(purchases: Purchase[], userIds: string[]): Map<string, number> {
  const out = new Map<string, number>(userIds.map((id) => [id, 0]));
  for (const p of purchases) {
    out.set(p.payerId, (out.get(p.payerId) ?? 0) + p.total);
    for (const s of p.shares) out.set(s.userId, (out.get(s.userId) ?? 0) - s.amount);
  }
  return out;
}

/**
 * Минимальный набор переводов, который гасит все долги.
 * Жадный алгоритм: самый большой должник платит самому большому кредитору.
 * Для четверых даёт максимум три перевода вместо двенадцати попарных.
 */
export function settle(balanceMap: Map<string, number>): Transfer[] {
  const creditors = [...balanceMap.entries()]
    .filter(([, v]) => v > 0)
    .map(([userId, amount]) => ({ userId, amount }))
    .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));
  const debtors = [...balanceMap.entries()]
    .filter(([, v]) => v < 0)
    .map(([userId, amount]) => ({ userId, amount: -amount }))
    .sort((a, b) => b.amount - a.amount || a.userId.localeCompare(b.userId));

  const out: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const give = Math.min(creditors[ci].amount, debtors[di].amount);
    if (give > 0) out.push({ from: debtors[di].userId, to: creditors[ci].userId, amount: give });
    creditors[ci].amount -= give;
    debtors[di].amount -= give;
    if (creditors[ci].amount === 0) ci++;
    if (debtors[di].amount === 0) di++;
  }
  return out;
}

const fmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
/**
 * Символ ₸ отсутствует и в Onest, и в JetBrains Mono — браузер подставлял под
 * него системный шрифт прямо посреди суммы. «тг» набирается тем же шрифтом,
 * что и всё остальное, и так пишут в Казахстане повсеместно.
 */
export const money = (n: number) => `${fmt.format(Math.round(n))} тг`;
