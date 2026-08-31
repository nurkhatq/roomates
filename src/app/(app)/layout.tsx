import { requireSession } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { HouseHeader } from '@/components/HouseHeader';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  return (
    <>
      <div className="pad-nav mx-auto w-full max-w-[560px] px-3.5">
        <HouseHeader houseName={s.household.name} code={s.household.inviteCode} me={s.member.name} />
        {children}
      </div>
      <BottomNav />
    </>
  );
}
