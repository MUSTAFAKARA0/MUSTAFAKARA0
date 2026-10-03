/**
 * Birim testleri için "@/…" yol takma adını (tsconfig paths) çözer: @/x → src/x(.ts|.tsx|/index.ts).
 * Yalnızca test çalıştırıcısı yükler (package.json › test:unit → --import ./tests/unit/register-alias.mjs).
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = fileURLToPath(new URL('../../src/', import.meta.url));

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const base = SRC + specifier.slice(2);
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
      if (existsSync(candidate) && !candidate.endsWith('/')) {
        try {
          return await next(pathToFileURL(candidate).href, context);
        } catch {
          /* klasör ise sonraki aday */
        }
      }
    }
  }
  return next(specifier, context);
}
