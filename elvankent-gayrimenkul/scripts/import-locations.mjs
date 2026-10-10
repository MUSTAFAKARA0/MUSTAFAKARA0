#!/usr/bin/env node
/**
 * Türkiye il / ilçe / mahalle referans verisini CSV'den içe aktarır.
 *
 * KAYNAK: Resmî ve güncel bir veri seti kullanın (ör. PTT posta kodu listesi —
 * il, ilçe, semt/bucak, mahalle, posta kodu — veya TÜİK/İçişleri UAVT çıktısı).
 * Kaynağı belli olmayan listeler kullanmayın. Ayrıntı: docs/LOCATION_DATA.md
 *
 * CSV biçimi (UTF-8, başlık satırı zorunlu, ayraç ; veya ,):
 *   il;ilce;mahalle;il_kodu;ilce_kodu;mahalle_kodu;enlem;boylam
 *   Ankara;Etimesgut;Elvankent;06;;;39.9472;32.6231
 * Yalnızca il, ilce, mahalle zorunludur. Aynı adlar tekrar içe aktarılırsa
 * güncellenir (slug anahtarlı upsert); mevcut ilanların bağlantıları bozulmaz.
 *
 * Kullanım:
 *   npm run import:locations -- --file=konumlar.csv            (kuru çalıştırma: ne ekleneceğini gösterir)
 *   npm run import:locations -- --file=konumlar.csv --apply    (veritabanına yazar)
 *
 * Gerekli: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Önce demo projesinde deneyin.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { slugify } from '../src/lib/slug.ts';

const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, ...v] = a.slice(2).split('='); return [k, v.join('=') || true]; }));
if (typeof flags.file !== 'string') { console.error('✗ --file=<csv> gerekli.'); process.exit(1); }
const apply = Boolean(flags.apply);

// ------------------------------------------------------------------ CSV
const raw = readFileSync(flags.file, 'utf8').replace(/^﻿/, '');
const lines = raw.split(/\r?\n/).filter((l) => l.trim() !== '');
const delimiter = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ';' : ',';
function parseLine(line) {
  const out = []; let cur = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') quoted = false; else cur += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === delimiter) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}
const header = parseLine(lines[0]).map((h) => slugify(h).replace(/-/g, '_'));
const col = (name) => header.indexOf(name);
for (const req of ['il', 'ilce', 'mahalle']) if (col(req) < 0) { console.error(`✗ CSV başlığında "${req}" sütunu yok. Bulunan: ${header.join(', ')}`); process.exit(1); }

const title = (s) => s.toLocaleLowerCase('tr-TR').replace(/(^|[\s\-/(])(\p{L})/gu, (_, sep, ch) => sep + ch.toLocaleUpperCase('tr-TR')).replace(/\s+/g, ' ').trim();
const num = (v) => (v === '' || v === undefined ? null : Number(String(v).replace(',', '.')));
const errors = [];
const cities = new Map(); // slug → {name, code}
const districts = new Map(); // citySlug/slug → {...}
const hoods = new Map(); // citySlug/districtSlug/slug → {...}
lines.slice(1).forEach((line, i) => {
  const v = parseLine(line);
  const il = title(v[col('il')] ?? ''), ilce = title(v[col('ilce')] ?? ''), mah = title((v[col('mahalle')] ?? '').replace(/\s+(mah\.?|mahallesi)$/i, ''));
  if (il.length < 2 || ilce.length < 2 || mah.length < 2) { errors.push(`satır ${i + 2}: eksik ad`); return; }
  const c = slugify(il), d = slugify(ilce), n = slugify(mah);
  const lat = num(v[col('enlem')]), lng = num(v[col('boylam')]);
  if ((lat !== null && (lat < 35 || lat > 43)) || (lng !== null && (lng < 25 || lng > 45.5))) { errors.push(`satır ${i + 2}: koordinat Türkiye dışında`); return; }
  if (!cities.has(c)) cities.set(c, { slug: c, name: il, code: col('il_kodu') >= 0 && v[col('il_kodu')] ? v[col('il_kodu')].padStart(2, '0') : null });
  if (!districts.has(`${c}/${d}`)) districts.set(`${c}/${d}`, { citySlug: c, slug: d, name: ilce, code: col('ilce_kodu') >= 0 ? v[col('ilce_kodu')] || null : null });
  hoods.set(`${c}/${d}/${n}`, { citySlug: c, districtSlug: d, slug: n, name: mah, code: col('mahalle_kodu') >= 0 ? v[col('mahalle_kodu')] || null : null, latitude: lat, longitude: lng });
});
console.info(`CSV: ${cities.size} il, ${districts.size} ilçe, ${hoods.size} mahalle${errors.length ? `, ${errors.length} hatalı satır` : ''}`);
errors.slice(0, 10).forEach((e) => console.warn(`  ! ${e}`));
if (!apply) { console.info('KURU ÇALIŞTIRMA: veritabanına yazılmadı. Yazmak için --apply ekleyin.'); process.exit(errors.length ? 2 : 0); }

// ------------------------------------------------------------------ Yazma
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('✗ NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.'); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function all(table, select) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).order('id').range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
await upsert('cities', [...cities.values()].map(({ slug, name, code }) => ({ slug, name, ...(code ? { code } : {}) })), 'slug');
const cityIds = new Map((await all('cities', 'id, slug')).map((c) => [c.slug, c.id]));
await upsert('districts', [...districts.values()].map(({ citySlug, slug, name, code }) => ({ city_id: cityIds.get(citySlug), slug, name, ...(code ? { code } : {}) })), 'city_id,slug');
const districtIds = new Map((await all('districts', 'id, slug, city_id')).map((d) => [`${d.city_id}/${d.slug}`, d.id]));
await upsert(
  'neighborhoods',
  [...hoods.values()].map(({ citySlug, districtSlug, slug, name, code, latitude, longitude }) => ({
    district_id: districtIds.get(`${cityIds.get(citySlug)}/${districtSlug}`),
    slug,
    name,
    ...(code ? { code } : {}),
    ...(latitude !== null && longitude !== null ? { latitude, longitude } : {}),
  })),
  'district_id,slug',
);
console.info('✓ İçe aktarıldı. Sitedeki listeler en geç 1 saat içinde (veya yeniden dağıtımla) güncellenir.');
