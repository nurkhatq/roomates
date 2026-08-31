import { eq, and, isNull, asc } from 'drizzle-orm';
import Link from 'next/link';
import { db, households, members } from '@/db';
import { Avatar, Card, btnGhost } from '@/components/ui';
import { AddSelf } from './AddSelf';
import { PickMe } from './PickMe';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const upper = decodeURIComponent(code).toUpperCase();

  const [house] = await db.select().from(households)
    .where(eq(households.inviteCode, upper)).limit(1);

  if (!house) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[440px] px-4 py-14">
        <Card><p className="text-[14px]">{t.join.badCode}</p></Card>
        <Link href="/" className={btnGhost}>{t.common.cancel}</Link>
      </main>
    );
  }

  const roommates = await db.select().from(members)
    .where(and(eq(members.householdId, house.id), isNull(members.leftAt)))
    .orderBy(asc(members.createdAt));

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] px-4 py-14">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{house.name}</h1>
      <p className="mb-8 text-[13.5px] text-ink-2">{t.join.whoAreYou}</p>
      <Card>
        <div className="flex flex-col">
          {roommates.map((m, i) => (
            <PickMe key={m.id} id={m.id}>
              <Avatar name={m.name} index={i} />
              <span className="truncate text-[15px]">{m.name}</span>
            </PickMe>
          ))}
          {roommates.length === 0 && (
            <p className="pb-3 text-[13px] text-ink-3">Тут пока никого. Добавься первым.</p>
          )}
        </div>
      </Card>
      <AddSelf code={upper} />
    </main>
  );
}
