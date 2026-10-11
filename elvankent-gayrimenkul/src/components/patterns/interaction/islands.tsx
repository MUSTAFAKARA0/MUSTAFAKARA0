'use client';

import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import type { InteractionPattern } from '@/theme-engine/ids';

/**
 * İNTERAKTİF DESEN YÜKLEME SÖZLEŞMESİ (D7.0 ölçümüyle kanıtlanan yöntem):
 * interaktif desenler YALNIZCA bu istemci bileşeninin içinden tembel yüklenir. Her ada ayrı bir
 * tarayıcı parçasıdır ve yalnızca manifestte seçildiğinde indirilir. Bu dosya dışında hiçbir
 * modül bir adayı statik içe aktaramaz (tests/unit/patterns.test.mjs). React.lazy kullanılır:
 * React zaten pakettedir, her kiracıya giden yükleyici maliyeti en düşük düzeydedir.
 */
const ISLANDS: Record<InteractionPattern, LazyExoticComponent<ComponentType>> = {
  'scroll-header': lazy(() => import('@/components/patterns/interaction/scroll-header')),
  'image-reveal': lazy(() => import('@/components/patterns/interaction/image-reveal')),
};

export function InteractionIslands({ ids }: { ids: readonly InteractionPattern[] }) {
  return (
    <Suspense fallback={null}>
      {ids.map((id) => {
        const Island = ISLANDS[id];
        return Island ? <Island key={id} /> : null;
      })}
    </Suspense>
  );
}
