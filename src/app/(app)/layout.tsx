import { requireSession } from '@/lib/session';
import { BottomNav } from '@/components/BottomNav';
import { HouseHeader } from '@/components/HouseHeader';
import Link from 'next/link';
import { Attn } from '@/components/ui';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  return (
    <>
      <div className="pad-nav mx-auto w-full max-w-[560px] px-3.5">
        <HouseHeader houseName={s.household.name} code={s.household.inviteCode} me={s.member.name} />
        {/* Пока пароля нет, под твоим именем зайдёт любой, кому переслали ссылку. */}
        {!s.member.passwordHash && (
          <Attn>
            <b>{t.me.noPasswordTitle}</b>{' '}
            <Link href="/ya" className="underline">{t.me.setPassword}</Link>
          </Attn>
        )}
        {children}
      </div>
      <BottomNav />
    </>
  );
}
