#!/usr/bin/env node
/**
 * KARAY — KI-24 K6: Storage geri yükleme doğrulaması (gidiş-dönüş SHA-256).
 *
 * Bir klasördeki dosyaları (gerçek provada R2 yedeğinden indirilmiş fotoğraf örneği; kuru provada sentetik dosyalar)
 * İZOLE ve GEÇİCİ bir Storage'a yükler, geri indirir ve her dosyanın SHA-256 özetini karşılaştırır.
 *
 * YALITIM: hedef yalnız çalıştırıcıdaki YEREL Supabase Storage olabilir — STORAGE_DRILL_URL yalnız
 *   http(s)://(127.0.0.1|localhost|[::1])[:port] (yol, sorgu, kullanıcı bilgisi yok). Başka her adres HİÇBİR istek
 *   gönderilmeden reddedilir (çıkış 2). Dosyalar adı "karay-k6-<zaman>-<pid>" olan YENİ, ÖZEL bir kovaya yüklenir;
 *   nesne adları sıra numarasıdır (gerçek yol kullanılmaz). Kova ve içeriği her durumda silinir.
 * GİZLİLİK: çıktıda dosya yolu, adı, boyutu veya içerik yazılmaz; yalnız "N/N SHA-256 aynı" ve hata türü.
 *
 * Kullanım:
 *   STORAGE_DRILL_URL=http://127.0.0.1:54321 STORAGE_DRILL_KEY=<yerel service_role anahtarı> \
 *     node scripts/storage-roundtrip-drill.mjs --from=<klasör> [--result=<dosya>] [--min=1]
 * Çıkış: 0 hepsi aynı · 1 fark / yükleme-indirme hatası / örnek yok · 2 yalıtım (yerel olmayan hedef)
 */
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.join('=') || true];
}));
const resultFile = typeof flags.result === 'string' ? flags.result : null;
if (resultFile) writeFileSync(resultFile, '');
const result = (line) => { if (resultFile) appendFileSync(resultFile, `${line}\n`); };
const isolation = (why) => {
  console.error(`✗ YALITIM: ${why} — Storage provası yalnız yerel, geçici Storage'a yapılır; hiçbir istek gönderilmedi`);
  process.exit(2);
};

const rawUrl = process.env.STORAGE_DRILL_URL ?? '';
const key = process.env.STORAGE_DRILL_KEY ?? '';
if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d{1,5})?\/?$/.test(rawUrl)) {
  isolation('STORAGE_DRILL_URL yerel değil (yalnız http://127.0.0.1 / localhost / [::1] + port; yol ve sorgu yok)');
}
const base = rawUrl.replace(/\/$/, '');
if (!key) { console.error('✗ STORAGE_DRILL_KEY (yerel service_role anahtarı) gerekli'); process.exit(1); }
if (typeof flags.from !== 'string') { console.error('✗ --from=<klasör> gerekli'); process.exit(1); }
const min = Number(flags.min ?? 1);

const list = (dir) => readdirSync(dir).flatMap((name) => {
  const p = path.join(dir, name);
  const st = statSync(p);
  return st.isDirectory() ? list(p) : st.isFile() ? [p] : [];
});
const files = list(path.resolve(flags.from)).sort();
const sha = (buf) => createHash('sha256').update(buf).digest('hex');
if (files.length < min) {
  console.error(`✗ K6: en az ${min} örnek dosya gerekli, ${files.length} bulundu`);
  result('STORAGE=HATA');
  process.exit(1);
}

const bucket = `karay-k6-${Date.now()}-${process.pid}`;
const headers = { Authorization: `Bearer ${key}`, apikey: key };
const call = async (method, p, body, extra = {}) => {
  const res = await fetch(`${base}/storage/v1/${p}`, { method, headers: { ...headers, ...extra }, body, redirect: 'error' });
  return res;
};

let created = false;
let ok = 0;
const problems = new Map();
const problem = (kind) => problems.set(kind, (problems.get(kind) ?? 0) + 1);
try {
  const mk = await call('POST', 'bucket', JSON.stringify({ id: bucket, name: bucket, public: false }), { 'content-type': 'application/json' });
  if (!mk.ok) throw new Error(`geçici kova oluşturulamadı (HTTP ${mk.status})`);
  created = true;
  for (const [i, file] of files.entries()) {
    const body = readFileSync(file);
    const want = sha(body);
    const name = `n/${String(i).padStart(5, '0')}`;
    const up = await call('POST', `object/${bucket}/${name}`, body, { 'content-type': 'application/octet-stream', 'x-upsert': 'false' });
    if (!up.ok) { problem(`yükleme HTTP ${up.status}`); continue; }
    const down = await call('GET', `object/authenticated/${bucket}/${name}`);
    if (!down.ok) { problem(`indirme HTTP ${down.status}`); continue; }
    const got = sha(Buffer.from(await down.arrayBuffer()));
    if (got === want) ok += 1; else problem('SHA-256 farklı');
  }
} catch (err) {
  problem(err instanceof Error ? err.message : 'beklenmeyen hata');
} finally {
  if (created) {
    try {
      const names = files.map((_, i) => `n/${String(i).padStart(5, '0')}`);
      for (let i = 0; i < names.length; i += 100) {
        await call('DELETE', `object/${bucket}`, JSON.stringify({ prefixes: names.slice(i, i + 100) }), { 'content-type': 'application/json' });
      }
      const del = await call('DELETE', `bucket/${bucket}`);
      if (!del.ok) problem(`geçici kova silinemedi (HTTP ${del.status})`);
    } catch {
      problem('geçici kova silinemedi');
    }
  }
}

const total = files.length;
const detail = [...problems].map(([k, n]) => `${k}: ${n}`).join(', ');
result(`STORAGE_DOSYA=${total}`);
result(`STORAGE_AYNI=${ok}`);
if (ok === total && problems.size === 0) {
  console.log(`K6 Storage: TAMAM — ${ok}/${total} dosya geçici Storage'a yüklendi, geri indirildi, SHA-256 aynı; geçici kova silindi`);
  result('STORAGE=TAMAM');
  process.exit(0);
}
console.error(`K6 Storage: HATA — ${ok}/${total} SHA-256 aynı (${detail})`);
result('STORAGE=HATA');
process.exit(1);
