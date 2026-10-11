#!/usr/bin/env node
/**
 * Supabase Storage yedeği (fotoğraflar, marka görselleri). Supabase veritabanı
 * yedekleri Storage dosyalarını KAPSAMAZ; bu betik tüm kovaları yerel bir
 * klasöre indirir ve bir bildirim dosyası (manifest.json: yol, boyut, SHA-256)
 * yazar. Klasör daha sonra S3 uyumlu bir depoya (R2, B2, S3) taşınır — otomatik
 * günlük yedek için bkz. .github/workflows/elvankent-backup.yml ve docs/BACKUP_RESTORE.md.
 *
 * Kullanım:
 *   npm run backup:storage -- --out=./yedek/storage            (artımlı: aynı boyuttaki dosyalar atlanır)
 *   npm run backup:storage -- --out=./yedek --buckets=media-originals,branding
 *
 * Gerekli: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (yalnızca okuma yapılır).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('✗ NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.'); process.exit(1); }
const out = path.resolve(typeof flags.out === 'string' ? flags.out : `./yedek/storage-${new Date().toISOString().slice(0, 10)}`);
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: buckets, error } = await db.storage.listBuckets();
if (error) { console.error(`✗ Kovalar listelenemedi: ${error.message}`); process.exit(1); }
const wanted = typeof flags.buckets === 'string' ? new Set(flags.buckets.split(',')) : null;

async function* walk(bucket, prefix = '') {
  for (let offset = 0; ; offset += 1000) {
    const { data, error: listError } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (listError) throw new Error(`${bucket}/${prefix}: ${listError.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) yield* walk(bucket, full); // klasör
      else yield { path: full, size: item.metadata?.size ?? null };
    }
    if (data.length < 1000) break;
  }
}

const manifest = { createdAt: new Date().toISOString(), source: new URL(url).host, buckets: {} };
let downloaded = 0, skipped = 0, failed = 0, bytes = 0;
for (const bucket of buckets) {
  if (wanted && !wanted.has(bucket.id)) continue;
  manifest.buckets[bucket.id] = { public: bucket.public, files: [] };
  for await (const file of walk(bucket.id)) {
    const target = path.join(out, bucket.id, file.path);
    if (!target.startsWith(path.join(out, bucket.id))) { failed++; continue; } // yol dışına yazmayı engelle
    if (existsSync(target) && file.size !== null && statSync(target).size === file.size) {
      skipped++;
      manifest.buckets[bucket.id].files.push({ path: file.path, size: file.size, skipped: true });
      continue;
    }
    const { data, error: dlError } = await db.storage.from(bucket.id).download(file.path);
    if (dlError) { failed++; console.warn(`  ! ${bucket.id}/${file.path}: ${dlError.message}`); continue; }
    const buf = Buffer.from(await data.arrayBuffer());
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, buf);
    downloaded++; bytes += buf.length;
    manifest.buckets[bucket.id].files.push({ path: file.path, size: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
  }
}
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.info(`✓ Yedek: ${out}\n  indirilen ${downloaded} dosya (${(bytes / 1048576).toFixed(1)} MB), atlanan ${skipped}, hatalı ${failed}`);
process.exit(failed ? 2 : 0);
