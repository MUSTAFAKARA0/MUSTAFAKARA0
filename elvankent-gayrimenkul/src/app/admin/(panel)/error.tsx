'use client';

import { PanelError } from '@/components/common/panel-error';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PanelError error={error} reset={reset} homeHref="/admin" homeLabel="Panele dön" />;
}
