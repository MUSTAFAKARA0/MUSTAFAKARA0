'use client';

import { PanelError } from '@/components/common/panel-error';

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PanelError error={error} reset={reset} homeHref="/platform" homeLabel="Genel bakışa dön" />;
}
