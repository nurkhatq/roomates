import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { EntryForms } from './EntryForms';
import { t } from '@/lib/strings';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (await getSession()) redirect('/zakup');
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[440px] px-4 py-14">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{t.app.name}</h1>
      <p className="mb-8 text-[13.5px] text-ink-2">
        Закуп, долги, расходники и дежурства на общую квартиру.
      </p>
      <EntryForms />
    </main>
  );
}
