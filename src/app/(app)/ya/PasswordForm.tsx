'use client';
import { useActionState, useState } from 'react';
import { setMyPassword, type FormState } from '@/lib/actions/password';
import { Card, Eyebrow, Attn, btnPrimary, btnGhost, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

/**
 * Пароль ставится и меняется здесь. Пока его нет, объясняем зачем он нужен:
 * просто «поставьте пароль» человек пролистает, а «под твоим именем зайдёт
 * любой, кому переслали ссылку» — нет.
 */
export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(!hasPassword);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await setMyPassword(prev, fd);
    if (res.ok) setOpen(false);
    return res;
  }, {} as FormState);

  if (!open) {
    return (
      <Card>
        <Eyebrow>{t.me.password}</Eyebrow>
        <button className={`${btnGhost} w-full`} onClick={() => setOpen(true)}>
          {t.me.changePassword}
        </button>
        {state.ok && <p className="mt-2 text-[12.5px] text-ink-3">{t.me.passwordSet}</p>}
      </Card>
    );
  }

  return (
    <Card>
      <Eyebrow>{t.me.password}</Eyebrow>
      {!hasPassword && (
        <Attn>
          <b>{t.me.noPasswordTitle}</b> {t.me.noPasswordWhy}
        </Attn>
      )}
      <form action={action} className="flex flex-col gap-3">
        {hasPassword && (
          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.me.currentPassword}</span>
            <input name="current" type="password" className={inputCls}
              autoComplete="current-password" required />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.me.newPassword}</span>
          <input name="next" type="password" className={inputCls}
            autoComplete="new-password" required autoFocus={!hasPassword} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>{t.me.repeatPassword}</span>
          <input name="repeat" type="password" className={inputCls} autoComplete="new-password" required />
        </label>
        {state.error && <p className="text-[13px] text-attn">{state.error}</p>}
        <div className="flex gap-2">
          <button className={`${btnPrimary} flex-1`} disabled={pending}>
            {pending ? t.common.loading : hasPassword ? t.me.changePassword : t.me.setPassword}
          </button>
          {hasPassword && (
            <button type="button" className={btnGhost} onClick={() => setOpen(false)}>
              {t.common.cancel}
            </button>
          )}
        </div>
      </form>
    </Card>
  );
}
