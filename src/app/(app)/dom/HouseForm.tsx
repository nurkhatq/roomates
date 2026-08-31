'use client';
import { useActionState, useState, useTransition } from 'react';
import { updateHousehold, setHouseholdPhoto, recordRent, type FormState } from '@/lib/actions/household';
import { splitEqual, money } from '@/lib/money';
import { PhotoPicker } from '@/components/PhotoPicker';
import { Card, Eyebrow, btnPrimary, inputCls, labelCls } from '@/components/ui';
import { t } from '@/lib/strings';

type House = {
  name: string; address: string; mapUrl: string;
  entrance: string; apartment: string; floor: string;
  rentAmount: number; rentDay: number | null; utilitiesAmount: number;
};

export function HouseForm({
  house, photoVersion, householdId, people,
}: { house: House; photoVersion: number | null; householdId: string; people: number }) {
  const [saved, setSaved] = useState(false);
  const [pendingRent, startRent] = useTransition();

  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await updateHousehold(prev, fd);
    setSaved(Boolean(res.ok));
    return res;
  }, {} as FormState);

  const share = house.rentAmount > 0 && people > 0 ? splitEqual(house.rentAmount, people)[0] : 0;

  const details = [
    house.entrance && `${t.house.entrance} ${house.entrance}`,
    house.apartment && `${t.house.apartment} ${house.apartment}`,
    house.floor && `${t.house.floor} ${house.floor}`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      {(house.address || house.mapUrl) && (
        <Card>
          <Eyebrow>{t.house.address}</Eyebrow>
          {/* Вся карточка адреса — ссылка: её открывают на бегу, попадать
              пальцем в мелкую строчку неудобно. noopener обязателен, иначе
              открытая вкладка получает доступ к window.opener этой страницы. */}
          {house.mapUrl ? (
            <a href={house.mapUrl} target="_blank" rel="noopener noreferrer"
              className="-m-1 flex items-center gap-3 rounded-lg p-1">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px]">{house.address || t.house.mapOpen}</span>
                {details && <span className="num block text-[12.5px] text-ink-3">{details}</span>}
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" className="shrink-0 text-ink-3" aria-hidden="true">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </a>
          ) : (
            <div>
              <p className="text-[15px]">{house.address}</p>
              {details && <p className="num text-[12.5px] text-ink-3">{details}</p>}
            </div>
          )}
        </Card>
      )}

      <Card>
        <Eyebrow>{t.house.photo}</Eyebrow>
        <PhotoPicker
          src={photoVersion ? `/api/photo/house/${householdId}?v=${photoVersion}` : null}
          alt={house.name}
          label={t.house.setPhoto}
          onPick={setHouseholdPhoto}
        />
      </Card>

      <Card>
        <form action={action} className="flex flex-col gap-3.5" onChange={() => setSaved(false)}>
          <Eyebrow>{t.house.title}</Eyebrow>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.house.name}</span>
            <input name="name" className={inputCls} defaultValue={house.name} required />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.house.address}</span>
            <input name="address" className={inputCls} defaultValue={house.address}
              placeholder="Улица Розы Баглановой, 1" autoComplete="street-address" />
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.house.mapUrl}</span>
            <input name="mapUrl" type="url" className={inputCls} defaultValue={house.mapUrl}
              placeholder="https://2gis.kz/astana/geo/..." inputMode="url" />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.house.entrance}</span>
              <input name="entrance" className={`${inputCls} num`} defaultValue={house.entrance} placeholder="8" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.house.apartment}</span>
              <input name="apartment" className={`${inputCls} num`} defaultValue={house.apartment} placeholder="384" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.house.floor}</span>
              <input name="floor" className={`${inputCls} num`} defaultValue={house.floor} placeholder="7" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.house.rent}</span>
              <input name="rentAmount" type="number" inputMode="numeric" min="0"
                className={`${inputCls} num`} defaultValue={house.rentAmount || ''} placeholder="70000" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelCls}>{t.house.rentDay}</span>
              <input name="rentDay" type="number" inputMode="numeric" min="1" max="31"
                className={`${inputCls} num`} defaultValue={house.rentDay ?? ''} placeholder="5" />
            </label>
          </div>

          {share > 0 && (
            <p className="-mt-1 text-[12px] text-ink-3">
              {t.house.rentPerPerson}: <span className="num">{money(share)}</span>
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className={labelCls}>{t.house.utilities}</span>
            <input name="utilitiesAmount" type="number" inputMode="numeric" min="0"
              className={`${inputCls} num`} defaultValue={house.utilitiesAmount || ''} placeholder="5000" />
          </label>

          {state.error && <p className="text-[13px] text-attn">{state.error}</p>}

          <button className={btnPrimary} disabled={pending}>
            {pending ? t.common.loading : saved ? t.house.saved : t.house.save}
          </button>
        </form>
      </Card>

      {house.rentAmount > 0 && (
        <Card>
          <Eyebrow>{t.house.rent}</Eyebrow>
          <button className={btnPrimary} disabled={pendingRent}
            onClick={() => startRent(() => { void recordRent(); })}>
            {pendingRent ? t.common.loading : t.house.recordRent}
          </button>
          <p className="mt-2.5 text-[12px] text-ink-3">{t.house.recordRentHint}</p>
        </Card>
      )}
    </>
  );
}
