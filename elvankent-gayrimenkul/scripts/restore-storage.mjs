#!/usr/bin/env node
/**
 * Storage geri yükleme. backup-storage.mjs ile alınmış klasörü kovalara yükler.
 *
 * GÜVENLİK: Varsayılan olarak yalnızca NE YAPILACAĞINI gösterir (kuru çalıştırma).
 * Gerçekten yüklemek için --apply verilmelidir. Var olan dosyaların üzerine
 * yazılmaz; gerekiyorsa --overwrite eklenir. Önce bir demo/test projesinde deneyin.
 *
 * BÜTÜNLÜK (Faz 3): klasördeki manifest.json'da SHA-256 özeti olan her dosya, yüklenmeden önce
 * yeniden özetlenir; uyuşmayan (bozuk) dosya YÜKLENMEZ ve hatalı sayılır. --verify yalnızca bu
 * denetimi yapar (Supabase'e bağlanmaz): manifest'teki her dosya diskte var ve özeti aynı mı.
 *
 * Kullanım:
 *   npm run restore:storage -- --from=./yedek/storage-2026-09-27 --verify        (yalnızca SHA-256 denetimi)
 *   npm run restore:storage -- --from=./yedek/storage-2026-09-27                 (kuru çalıştırma)
 *   npm run restore:storage -- --from=./yedek/storage-2026-09-27 --apply         (eksik dosyaları yükler)
 *   npm run restore:storage -- --from=... --buckets=media-originals --apply
 *
 * Çıkış kodu: 0 sorunsuz · 1 eksik ayar / manifest yok (--verify) · 2 bozuk, eksik veya yüklenemeyen dosya
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
if (typeof flags.from !== 'string') { console.error('✗ --from=<yedek klasörü> gerekli.'); process.exit(1); }
const from = path.resolve(flags.from);
const verifyOnly = Boolean(flags.verify);
const apply = Boolean(flags.apply) && !verifyOnly;
const overwrite = Boolean(flags.overwrite);
const wanted = typeof flags.buckets === 'string' ? new Set(flags.buckets.split(',')) : null;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!verifyOnly && (!url || !key)) { console.error('✗ NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.'); process.exit(1); }
const db = verifyOnly ? null : createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// manifest.json: { buckets: { <kova>: { files: [{ path, size, sha256 }] } } }
const manifestFile = path.join(from, 'manifest.json');
const expected = new Map();
if (existsSync(manifestFile)) {
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  for (const [bucket, entry] of Object.entries(manifest.buckets ?? {})) {
    if (wanted && !wanted.has(bucket)) continue;
    for (const file of entry.files ?? []) if (file.sha256) expected.set(`${bucket}/${file.path}`, file.sha256);
  }
} else if (verifyOnly) {
  console.error('✗ manifest.json yok: SHA-256 doğrulaması yapılamaz.');
  process.exit(1);
} else {
  console.warn('! manifest.json yok: dosyalar SHA-256 doğrulaması yapılmadan yüklenecek.');
}

const CONTENT_TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif', '.svg': 'image/svg+xml' };
function* files(dir, base = '') {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (statSync(full).isDirectory()) yield* files(full, rel);
    else yield { full, rel };
  }
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

console.info(`${verifyOnly ? 'SHA-256 DOĞRULAMASI (yükleme yok)' : apply ? 'GERİ YÜKLEME' : 'KURU ÇALIŞTIRMA (değişiklik yapılmaz, --apply ile uygulanır)'}${db ? ` → ${new URL(url).host}` : ''}`);
let uploaded = 0, exists = 0, failed = 0, planned = 0, verified = 0, unverified = 0;
const seen = new Set();
for (const bucket of readdirSync(from).filter((d) => statSync(path.join(from, d)).isDirectory())) {
  if (wanted && !wanted.has(bucket)) continue;
  for (const { full, rel } of files(path.join(from, bucket))) {
    planned++;
    const id = `${bucket}/${rel}`;
    seen.add(id);
    const buf = readFileSync(full);
    const want = expected.get(id);
    if (want) {
      if (sha256(buf) !== want) { failed++; console.warn(`  ! ${id}: SHA-256 manifest ile uyuşmuyor (dosya bozuk); yüklenmedi`); continue; }
      verified++;
    } else unverified++;
    if (!apply) continue;
    const contentType = CONTENT_TYPES[path.extname(rel).toLowerCase()] ?? 'application/octet-stream';
    const { error } = await db.storage.from(bucket).upload(rel, buf, { contentType, upsert: overwrite });
    if (!error) uploaded++;
    else if (/exists|Duplicate/i.test(error.message)) exists++;
    else { failed++; console.warn(`  ! ${id}: ${error.message}`); }
  }
}
// Manifest'te olup diskte olmayan dosya: yedek eksik
let missing = 0;
for (const id of expected.keys()) if (!seen.has(id)) { missing++; failed++; console.warn(`  ! ${id}: manifest'te var, yedek klasöründe yok`); }

const integrity = `SHA-256 doğrulanan ${verified}, manifest'te özeti olmayan ${unverified}, eksik ${missing}`;
if (verifyOnly) console.info(`${failed ? '✗' : '✓'} ${integrity}, bozuk ${failed - missing}`);
else console.info(apply ? `✓ yüklenen ${uploaded}, zaten var ${exists}, hatalı ${failed} · ${integrity}` : `  ${planned} dosya yüklenecek (var olanlar atlanır) · ${integrity}`);
process.exit(failed ? 2 : 0);
