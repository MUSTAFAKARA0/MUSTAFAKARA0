#!/usr/bin/env node
/**
 * DEMO Supabase projesi için Supabase SQL Editor'e yapıştırılacak dosyaları üretir:
 *
 *   supabase/demo/01_v1_schema.sql     boş veritabanı kontrolü + DEMO işareti + V1 şeması
 *   supabase/demo/02_v2_enums.sql      V2 enum değerleri (ayrı çalıştırılmalı: yeni enum
 *                                      değerleri ancak commit sonrası kullanılabilir)
 *   supabase/demo/03_v2_stage3.sql     V2 + Stage 3 migration'ları
 *   supabase/demo/04_demo_seed.sql     12 DEMO ilan (seed.sql + açık onay satırı)
 *   supabase/demo/06_platform_updates.sql  sonradan eklenen migration'lar (29.09.2026+),
 *                                      kurulu demo projesinde 05'ten sonra çalıştırılır
 *
 * Kaynak her zaman supabase/migrations ve supabase/seed.sql'dir; bu dosyalar yalnızca
 * onların sıralı birleşimidir (elle düzenlemeyin). 01 dışındaki her dosya, veritabanında
 * 01'in oluşturduğu DEMO işareti yoksa hiçbir şey yapmadan hata verir; böylece
 * yanlışlıkla canlı (production) veritabanında çalıştırılamaz.
 *
 * Kullanım:
 *   npm run demo:sql            dosyaları üretir
 *   npm run demo:sql -- --check dosyalar güncel değilse hata verir (CI)
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migDir = join(root, 'supabase/migrations');
const outDir = join(root, 'supabase/demo');
const check = process.argv.includes('--check');

const migrations = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
const V1 = migrations.filter((f) => f.startsWith('20260922'));
const ENUMS = migrations.filter((f) => f === '20260926000001_v2_enums.sql');
// 29.09.2026 ve sonrası: demo projesine sonradan eklenen migration'lar (ayrı dosya: 06)
const LATER = migrations.filter((f) => f >= '20260929');
const REST = migrations.filter((f) => !V1.includes(f) && !ENUMS.includes(f) && !LATER.includes(f));
if (V1.length !== 4 || ENUMS.length !== 1) throw new Error('Beklenmeyen migration listesi');

const header = (title, note) => `-- =============================================================================
-- ${title}
-- YALNIZCA DEMO SUPABASE PROJESİ İÇİNDİR. Canlı (production) veritabanında çalıştırmayın.
-- Otomatik üretildi (npm run demo:sql) — elle düzenlemeyin; kaynak: supabase/migrations
-- ${note}
-- =============================================================================
`;

const requireMarker = `-- Güvenlik: bu veritabanı 01_v1_schema.sql ile kurulmuş DEMO veritabanı değilse dur
do $demo_guard$
begin
  if to_regclass('elvankent_demo.environment') is null then
    raise exception 'DURDURULDU: Bu veritabanı DEMO olarak işaretli değil. Önce 01_v1_schema.sql dosyasını YENİ ve BOŞ demo projesinde çalıştırın. Canlı veritabanında çalıştırmayın.';
  end if;
end
$demo_guard$;
`;

const history = (files) => `
-- Supabase CLI migration geçmişi (ileride "supabase db push" yalnızca yeni dosyaları uygular)
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
insert into supabase_migrations.schema_migrations (version, name) values
${files.map((f) => `  ('${f.slice(0, 14)}', '${f.slice(15, -4)}')`).join(',\n')}
on conflict (version) do nothing;
`;

const body = (files) =>
  files.map((f) => `\n-- ---------------------------------------------------------------------------\n-- ${f}\n-- ---------------------------------------------------------------------------\n${readFileSync(join(migDir, f), 'utf8').trimEnd()}\n`).join('');

const outputs = {
  '01_v1_schema.sql':
    header('DEMO KURULUM 1/4 — V1 şeması', 'Boş, yeni bir Supabase projesinde SQL Editor > New query > yapıştır > Run.') +
    `
-- Güvenlik: yalnızca BOŞ veritabanında çalışır (canlı veritabanında V1 tabloları vardır → durur)
do $demo_guard$
begin
  if exists (select 1 from pg_tables where schemaname = 'public') then
    raise exception 'DURDURULDU: public şemasında tablo var. Bu dosya yalnızca YENİ ve BOŞ demo projesi içindir.';
  end if;
end
$demo_guard$;

-- DEMO işareti (sonraki dosyalar bunu arar). API'ye açık olmayan ayrı şemada tutulur.
create schema elvankent_demo;
revoke all on schema elvankent_demo from public;
create table elvankent_demo.environment (
  id int primary key default 1 check (id = 1),
  purpose text not null default 'DEMO — gerçek müşteri/ilan verisi içermez',
  created_at timestamptz not null default now()
);
insert into elvankent_demo.environment default values;
` +
    body(V1) +
    history(V1),
  '02_v2_enums.sql':
    header('DEMO KURULUM 2/4 — V2 enum değerleri', '01 başarıyla bittikten sonra, AYRI bir sorgu olarak çalıştırın.') +
    '\n' +
    requireMarker +
    body(ENUMS) +
    history(ENUMS),
  '03_v2_stage3.sql':
    header('DEMO KURULUM 3/4 — V2 + Stage 3', '02 başarıyla bittikten sonra, AYRI bir sorgu olarak çalıştırın.') +
    '\n' +
    requireMarker +
    body(REST) +
    history(REST) +
    "\n-- API şema önbelleğini yenile\nnotify pgrst, 'reload schema';\n",
  '04_demo_seed.sql':
    header('DEMO KURULUM 4/4 — 12 DEMO ilan', '03 başarıyla bittikten sonra çalıştırın. Kaynak: supabase/seed.sql') +
    '\n' +
    requireMarker +
    "\n-- Açık onay: seed.sql bu ayar olmadan çalışmaz\nselect set_config('app.allow_demo_seed', 'on', false);\n\n" +
    readFileSync(join(root, 'supabase/seed.sql'), 'utf8').trimEnd() +
    '\n',
  '06_platform_updates.sql':
    header(
      'DEMO GÜNCELLEME 6 — kurulum sonrası eklenen migration\'lar',
      'Kurulu demo projesinde (01–05 bitmiş) SQL Editor > New query > yapıştır > Run. Tekrar çalıştırılabilir.',
    ) +
    '\n' +
    requireMarker +
    body(LATER) +
    history(LATER) +
    "\n-- API şema önbelleğini yenile\nnotify pgrst, 'reload schema';\n",
};

let stale = [];
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
for (const [name, content] of Object.entries(outputs)) {
  const path = join(outDir, name);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (current === content) continue;
  if (check) stale.push(name);
  else {
    writeFileSync(path, content);
    console.info(`• ${name} yazıldı (${(content.length / 1024).toFixed(0)} KB)`);
  }
}
if (check && stale.length) {
  console.error(`✗ supabase/demo güncel değil: ${stale.join(', ')} — "npm run demo:sql" çalıştırın.`);
  process.exit(1);
}
if (check) console.info('✓ supabase/demo dosyaları güncel');
