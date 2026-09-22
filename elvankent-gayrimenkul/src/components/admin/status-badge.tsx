import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS } from '@/lib/constants';
import type { PropertyStatus } from '@/types/database';

const VARIANT: Record<PropertyStatus, 'success' | 'neutral' | 'warning' | 'info' | 'danger'> = {
  active: 'success',
  draft: 'neutral',
  passive: 'warning',
  sold: 'info',
  rented: 'info',
};

export function StatusBadge({ status }: { status: PropertyStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}
