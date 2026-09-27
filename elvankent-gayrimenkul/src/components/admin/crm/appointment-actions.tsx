'use client';

import { ActionButton } from '@/components/admin/action-controls';
import { updateAppointment } from '@/app/actions/admin-crm';
import { APPOINTMENT_TRANSITIONS, type AppointmentStatus } from '@/modules/crm/constants';

const LABELS: Partial<Record<AppointmentStatus, string>> = {
  confirmed: 'Onayla',
  completed: 'Tamamlandı',
  cancelled: 'İptal et',
  requested: 'Yeniden aç',
};

export function AppointmentActions({ id, status }: { id: string; status: AppointmentStatus }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {APPOINTMENT_TRANSITIONS[status].map((next) => (
        <ActionButton
          key={next}
          size="xs"
          variant={next === 'cancelled' ? 'danger-ghost' : next === 'confirmed' ? 'primary' : 'outline'}
          confirm={next === 'cancelled' ? { title: 'Randevu iptal edilsin mi?', confirmLabel: 'İptal et' } : undefined}
          action={() => updateAppointment(id, { status: next })}
        >
          {LABELS[next] ?? next}
        </ActionButton>
      ))}
    </div>
  );
}
