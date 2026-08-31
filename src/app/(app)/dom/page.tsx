import { requireSession } from '@/lib/session';
import { photoVersions } from '@/lib/queries';
import { db } from '@/db';
import { HouseForm } from './HouseForm';

export const dynamic = 'force-dynamic';

export default async function DomPage() {
  const s = await requireSession();
  const v = await photoVersions(db, s.household.id, []);
  return (
    <HouseForm
      house={{
        name: s.household.name,
        address: s.household.address,
        mapUrl: s.household.mapUrl,
        entrance: s.household.entrance,
        apartment: s.household.apartment,
        floor: s.household.floor,
        rentAmount: s.household.rentAmount,
        rentDay: s.household.rentDay,
        utilitiesAmount: s.household.utilitiesAmount,
      }}
      photoVersion={v.house}
      householdId={s.household.id}
      people={s.roommates.length}
    />
  );
}
