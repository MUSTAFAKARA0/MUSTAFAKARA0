#!/usr/bin/env node
/**
 * Storage geri yükleme. backup-storage.mjs ile alınmış klasörü kovalara yükler.
 *
 * GÜVENLİK: Varsayılan olarak yalnızca NE YAPILACAĞINI gösterir (kuru çalıştırma).
 * Gerçekten yüklemek için --apply verilmelidir. Var olan dosyaların üzerine
 * yazılmaz; gerekiyorsa --overwrite eklenir. Önce bir demo/test projesinde deneyin.
 *
 * Kullanım:
 *   npm run restore:storage -- --from=./yedek/storage-2026-09-27                 (kuru çalıştırma)
 *   npm run restore:storage -- --from=./yedek/storage-2026-09-27 --apply         (eksik dosyaları yükler)
 *   npm run restore:storage -- --from=... --buckets=media-originals --apply
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('✗ NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.'); process.exit(1); }
if (typeof flags.from !== 'string') { console.error('✗ --from=<yedek klasörü> gerekli.'); process.exit(1); }
const from = path.resolve(flags.from);
const apply = Boolean(flags.apply);
const overwrite = Boolean(flags.overwrite);
const wanted = typeof flags.buckets === 'string' ? new Set(flags.buckets.split(',')) : null;
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const CONTENT_TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif', '.svg': 'image/svg+xml' };
function* files(dir, base = '') {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) yield* files(full, rel);
    else yield { full, rel };
  }
}

console.info(`${apply ? 'GERİ YÜKLEME' : 'KURU ÇALIŞTIRMA (değişiklik yapılmaz, --apply ile uygulanır)'} → ${new URL(url).host}`);
let uploaded = 0, exists = 0, failed = 0, planned = 0;
for (const bucket of readdirSync(from).filter((d) => statSync(path.join(from, d)).isDirectory())) {
  if (wanted && !wanted.has(bucket)) continue;
  for (const { full, rel } of files(path.join(from, bucket))) {
    planned++;
    if (!apply) continue;
    const contentType = CONTENT_TYPES[path.extname(rel).toLowerCase()] ?? 'application/octet-stream';
    const { error } = await db.storage.from(bucket).upload(rel, readFileSync(full), { contentType, upsert: overwrite });
    if (!error) uploaded++;
    else if (/exists|Duplicate/i.test(error.message)) exists++;
    else { failed++; console.warn(`  ! ${bucket}/${rel}: ${error.message}`); }
  }
}
console.info(apply ? `✓ yüklenen ${uploaded}, zaten var ${exists}, hatalı ${failed}` : `  ${planned} dosya yüklenecek (var olanlar atlanır).`);
process.exit(failed ? 2 : 0);
