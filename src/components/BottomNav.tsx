'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/strings';

const TABS = [
  { href: '/zakup', label: t.nav.money,
    icon: <><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.6" /><path d="M6 10v4M18 10v4" /></> },
  { href: '/veshi', label: t.nav.things,
    icon: <><path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" /><path d="M4 8.5 12 13l8-4.5M12 13v7" /></> },
  { href: '/dezhurstva', label: t.nav.chores,
    icon: <><path d="M20 7 9.5 17.5 4 12" /><path d="M20 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H15" /></> },
  { href: '/ya', label: t.nav.me,
    icon: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></> },
];

/*
 * Панель намеренно НЕ прячется на время набора текста.
 *
 * Такая попытка была и обернулась пропажей нажатий: пока человек печатает,
 * панель скрыта, а в момент нажатия на кнопку внизу формы фокус уходит из
 * поля, панель возвращается ровно под палец и забирает нажатие себе. Кнопка
 * «Записать» переставала работать. Зум на айфоне лечится размером шрифта у
 * полей (16px в globals.css), а не прятками.
 */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-card pb-[env(safe-area-inset-bottom,0px)]"
      aria-label={t.nav.label}>
      {TABS.map((tab) => {
        const active = path.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[12px] font-medium ${
              active ? 'text-ink' : 'text-ink-3'}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{tab.icon}</svg>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
