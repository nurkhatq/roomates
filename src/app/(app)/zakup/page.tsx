import { db } from '@/db';
import { requireSession } from '@/lib/session';
import { householdBalances, recentPurchases } from '@/lib/queries';
import { settle, money } from '@/lib/money';
import { Avatar, Card, Eyebrow, Empty, Dot } from '@/components/ui';
import { AddPurchase } from './AddPurchase';
import { SettleButton } from './SettleButton';
import { PurchaseRow } from './PurchaseRow';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 30;

export default async function ZakupPage() {
  const s = await requireSession();
  const hid = s.household.id;
  const idx = new Map(s.roommates.map((m, i) => [m.id, i]));
  const nameOf = (id: string) => s.roommates.find((m) => m.id === id)?.name ?? '—';

  const bal = await householdBalances(db, hid, s.roommates.map((m) => m.id));
  const transfers = settle(bal);
  const allSquare = transfers.length === 0;

  const { rows: recent, sharesBy } = await recentPurchases(db, hid, HISTORY_LIMIT);

  const dateFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' });

  return (
    <>
      <Card>
        <Eyebrow>{t.money.title}</Eyebrow>
        {allSquare ? (
          <p className="py-2 text-[15px]">{t.money.balanceZero}</p>
        ) : (
          <div className="flex flex-col">
            {s.roommates.map((m, i) => {
              const v = bal.get(m.id) ?? 0;
              if (v === 0) return null;
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-b-0">
                  <Avatar name={m.name} index={i} />
                  <span className="min-w-0 flex-1 truncate text-[14px]">
                    {m.name}{m.id === s.member.id ? ` (${t.common.you})` : ''}
                  </span>
                  <span className="text-right">
                    <span className="num block text-[15px] font-medium">{money(Math.abs(v))}</span>
                    <span className="block text-[11.5px] text-ink-3">
                      {v > 0 ? 'ему должны' : 'он должен'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {!allSquare && (
        <Card>
          <Eyebrow>{t.money.settleUp}</Eyebrow>
          <div className="flex flex-col gap-2">
            {transfers.map((tr) => (
              <div key={`${tr.from}-${tr.to}`} className="flex items-center gap-2.5">
                <Dot index={idx.get(tr.from) ?? 0} />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">
                  {nameOf(tr.from)} → {nameOf(tr.to)}
                </span>
                <span className="num text-[14px] font-medium">{money(tr.amount)}</span>
                <SettleButton from={tr.from} to={tr.to} amount={tr.amount} />
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-3">{t.money.settleHint}</p>
        </Card>
      )}

      <AddPurchase roommates={s.roommates.map((m, i) => ({ id: m.id, name: m.name, index: i }))} meId={s.member.id} />

      <Card>
        <Eyebrow>{t.money.history}</Eyebrow>
        {recent.length === 0 ? (
          <Empty>{t.money.empty}</Empty>
        ) : (
          <div className="flex flex-col">
            {recent.map((p) => {
              const sh = sharesBy.get(p.id) ?? [];
              const isSettlement = p.kind === 'settlement';
              return (
                <PurchaseRow key={p.id} id={p.id}>
                  <Avatar name={nameOf(p.payerId)} index={idx.get(p.payerId) ?? 0} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px]">
                      {isSettlement
                        ? `${nameOf(p.payerId)} → ${nameOf(sh[0]?.memberId ?? '')}`
                        : p.note || 'Закуп'}
                    </div>
                    <div className="num truncate text-[11.5px] text-ink-3">
                      {dateFmt.format(p.boughtAt)}
                      {isSettlement
                        ? ` · ${t.money.settlement}`
                        : ` · ${nameOf(p.payerId)} · ${t.money.perPerson} ${money(sh[0]?.amount ?? 0)}`}
                    </div>
                  </div>
                  <span className="num shrink-0 text-[14px] font-medium">{money(p.total)}</span>
                </PurchaseRow>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
