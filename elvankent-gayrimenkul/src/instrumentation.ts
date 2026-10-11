import type { Instrumentation } from 'next';

/**
 * Sunucu tarafı hata yakalama: Server Component render, Route Handler,
 * Server Action ve Proxy hataları buraya düşer (ör. 500 hataları).
 * Rapor sağlayıcıları için bkz. src/modules/monitoring/report.ts
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { reportError } = await import('@/modules/monitoring/report');
  const error = err instanceof Error ? err : new Error(String(err));
  const digest = typeof err === 'object' && err !== null && 'digest' in err ? String((err as { digest: unknown }).digest) : undefined;
  await reportError({
    kind: 'server',
    name: error.name,
    message: error.message,
    stack: error.stack,
    digest,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
  });
};
