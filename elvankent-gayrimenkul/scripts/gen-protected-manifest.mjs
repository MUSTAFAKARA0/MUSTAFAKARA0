/**
 * Faz 3 koruma manifesti: görsel/UX fazının iş mantığına dokunmadığını kanıtlar. src/app/actions, src/modules ve
 * src/platform/auth altındaki dosyaların dışa aktarım yüzeyi tests/unit/protected-surface.json içinde tutulur;
 * tests/unit/admin-tokens.test.mjs (AT-10a) karşılaştırır. Dosya içi düzenlemeler serbesttir (özet karşılaştırması
 * bilinçli olarak yok: iş mantığı dizinlerini kalıcı olarak dondurur ve satır sonu farkına kırılgandır).
 *
 * Bu betik YALNIZCA bilinçli olarak, bu dizinlerdeki bir değişiklik gözden geçirildikten sonra çalıştırılır:
 *   node scripts/gen-protected-manifest.mjs
 * CI'da çalışmayı reddeder (manifest hiçbir zaman CI içinde yeniden üretilmez).
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.CI) {
  console.error('CI içinde manifest yeniden üretilmez.');
  process.exit(1);
}
export const PROTECTED_DIRS = ['src/app/actions', 'src/modules', 'src/platform/auth'];
const root = new URL('../', import.meta.url).pathname;

function walk(dir) {
  return readdirSync(join(root, dir))
    .sort()
    .flatMap((n) => {
      const rel = `${dir}/${n}`;
      return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
    });
}

function surfaceOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class|enum|interface|type)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s*(?:type\s*)?\{([^}]*)\}/gm)) for (const part of m[1].split(',')) if (part.trim()) names.add(part.trim().split(/\s+as\s+/).pop());
  for (const m of src.matchAll(/^export\s*\*\s*(?:as\s+([A-Za-z0-9_$]+)\s+)?from\s+['"]([^'"]+)['"]/gm)) names.add(`*${m[1] ?? ''}:${m[2]}`);
  if (/^export\s+default\b/m.test(src)) names.add('default');
  return [...names].sort();
}

const surface = {};
for (const d of PROTECTED_DIRS) {
  for (const f of walk(d).filter((x) => /\.(ts|tsx|mjs)$/.test(x))) {
    const names = surfaceOf(readFileSync(join(root, f), 'utf8'));
    if (names.length) surface[f] = names;
  }
}
writeFileSync(join(root, 'tests/unit/protected-surface.json'), `${JSON.stringify(surface, null, 1)}\n`);
console.log(`${Object.keys(surface).length} dosyanın dışa aktarım yüzeyi yazıldı`);
