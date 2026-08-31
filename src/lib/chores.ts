/**
 * Дежурства. Принцип тот же, что во всём проекте: система показывает факт,
 * а не командует. Никаких «просрочено» красным — только «сколько дней прошло»
 * и чья очередь по кругу.
 */

export type Chore = {
  id: string;
  name: string;
  /** Как часто это вообще нужно делать. */
  periodDays: number;
  /** Сколько человек делают это вместе: мусор — один, генералку — вдвоём. */
  groupSize: number;
  /** Очередь по кругу. */
  order: string[];
  lastDoneAt: Date | null;
  lastDoneBy: string | null;
};

export type ChoreState = {
  /** Чья очередь сейчас. Для дела на одного — один человек, иначе несколько. */
  assignees: string[];
  /** Первый из очереди. Удобно там, где нужен один человек. */
  assignee: string | null;
  /** Когда подойдёт срок. */
  dueOn: Date | null;
  /** Сколько дней прошло с последнего раза. */
  daysSince: number | null;
  /** Сколько дней до срока. Отрицательное — срок прошёл столько дней назад. */
  daysUntilDue: number | null;
};

const DAY = 86_400_000;

export function choreState(c: Chore, now: Date = new Date()): ChoreState {
  if (c.order.length === 0) {
    return { assignees: [], assignee: null, dueOn: null, daysSince: null, daysUntilDue: null };
  }

  // Сколько человек берём за раз. Больше, чем есть в очереди, взять нельзя.
  const size = Math.max(1, Math.min(Math.round(c.groupSize) || 1, c.order.length));

  // Очередь следующих. Если предыдущий съехал и его нет в списке — начинаем сначала.
  let from = 0;
  if (c.lastDoneBy) {
    const i = c.order.indexOf(c.lastDoneBy);
    if (i >= 0) from = (i + 1) % c.order.length;
  }
  const assignees = Array.from({ length: size }, (_, k) => c.order[(from + k) % c.order.length]);

  if (!c.lastDoneAt) {
    return { assignees, assignee: assignees[0], dueOn: now, daysSince: null, daysUntilDue: 0 };
  }

  const dueOn = new Date(c.lastDoneAt.getTime() + c.periodDays * DAY);
  return {
    assignees,
    assignee: assignees[0],
    dueOn,
    daysSince: (now.getTime() - c.lastDoneAt.getTime()) / DAY,
    daysUntilDue: (dueOn.getTime() - now.getTime()) / DAY,
  };
}

/** Кто сколько раз это делал. Просто счётчик, без рейтингов и мест. */
export function tally(events: { userId: string }[], userIds: string[]): Map<string, number> {
  const out = new Map<string, number>(userIds.map((id) => [id, 0]));
  for (const e of events) out.set(e.userId, (out.get(e.userId) ?? 0) + 1);
  return out;
}
