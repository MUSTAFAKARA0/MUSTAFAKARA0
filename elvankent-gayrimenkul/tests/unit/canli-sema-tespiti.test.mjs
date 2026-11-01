/**
 * KT-xx · KI-23 canlı şema tespiti (supabase/ops/canli_sema_tespiti.sql) ve O-5 yükseltme provası (scripts/o5-upgrade-rehearsal.sh).
 *
 *   KT-01  Tespit sorgusu tek bir SELECT: yazma / DDL / ayar / fonksiyon çağrısıyla yan etki yok; kişisel veri yazdırmaz.
 *   KT-02  31 migration'ın HER BİRİ ve 8 bekleyen dosyanın her biri tam bir kez, dosya sırasıyla listelenir (yeni migration
 *          eklenip tespit güncellenmezse test kırmızı olur).
 *   KT-03  O-5 provası yalnız yerel veritabanını kabul eder; dosyaları tek işlemde uygular; KARAYS runbook'uyla gider;
 *          canlı benzeri yığın TOTP'yi canlıdaki gibi açar.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const sqlFile = read('supabase/ops/canli_sema_tespiti.sql');
// Yorumlar ve tırnak içi metinler çıkarılınca kalan SQL gövdesi
const body = sqlFile.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
const bare = body.replace(/'(?:[^']|'')*'/g, "''");
const migrations = readdirSync(path.join(root, 'supabase/migrations')).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();
const pending = readdirSync(path.join(root, 'supabase/pending')).filter((f) => /^\d{14}_.+\.sql$/.test(f)).sort();

describe('KT-01 tespit sorgusu salt okunur', () => {
  test('tek ifade, WITH … SELECT; DDL/DML/ayar komutu yok', () => {
    assert.match(bare.trim(), /^with checks\(sira, dosya, kosul\) as \(/);
    assert.equal((bare.match(/;/g) ?? []).length, 1, 'tek ifade');
    assert.ok(bare.trim().endsWith('order by 1;'));
    for (const bad of [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bcreate\b/i, /\balter\b/i, /\bdrop\b/i,
      /\btruncate\b/i, /\bgrant\b/i, /\brevoke\b/i, /\bset\s+\w/i, /\bcopy\b/i, /\bdo\b\s*\$/i, /\bcall\b/i,
      /set_config/i, /pg_terminate|pg_cancel|pg_reload|lo_import|lo_export|dblink/i]) {
      assert.doesNotMatch(bare, bad, `yasak: ${bad}`);
    }
  });
  test('dolaylı okumalar yalnız sayım / dizi üyeliği / sürüm; kayıt içeriği yazdırılmaz', () => {
    const inner = [...body.matchAll(/query_to_xml\('((?:[^']|'')*)'/g)].map((m) => m[1]);
    assert.ok(inner.length >= 4);
    for (const q of inner) {
      assert.match(q, /^select (count\(\*\)|\(''service_area''|public\.karay_schema_version\(\))/, q);
      assert.doesNotMatch(q, /email|phone|name|body|token/i, q);
    }
    // Tırnak içi dahil çağrılan public fonksiyonlar yalnız sürüm fonksiyonu ve site_brand_columns (sabit dizi)
    const calls = [...body.matchAll(/public\.(\w+)\(/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(calls)].sort(), ['karay_schema_version', 'site_brand_columns']);
  });
});

describe('KT-02 her migration ve bekleyen dosya tam bir kez, sırayla', () => {
  const rows = [...body.matchAll(/\((\d+),\s*'([^']+)'/g)].map((m) => ({ sira: Number(m[1]), dosya: m[2] }));
  test('31 migration = supabase/migrations', () => {
    const mig = rows.filter((r) => !r.dosya.startsWith('pending/'));
    assert.deepEqual(mig.map((r) => r.dosya), migrations);
    assert.deepEqual(mig.map((r) => r.sira), migrations.map((_, i) => i + 1));
    assert.match(body, new RegExp(`mig as \\(select \\* from checks where sira <= ${migrations.length}\\)`));
  });
  test('bekleyenler = supabase/pending, migration\'lardan sonra', () => {
    const pen = rows.filter((r) => r.dosya.startsWith('pending/'));
    assert.deepEqual(pen.map((r) => r.dosya.slice(8)), pending);
    assert.deepEqual(pen.map((r) => r.sira), pending.map((_, i) => migrations.length + i + 1));
  });
  test('özet satırları: sürüm, schema_migrations, ilk eksik, tutarlılık (DİKKAT dalı var)', () => {
    for (const s of ["select 100, 'karay_schema_version()'", 'select 101,', "select 102, 'İLK EKSİK migration'", "select 103, 'TUTARLILIK'"]) {
      assert.ok(body.includes(s), s);
    }
    assert.match(body, /'DİKKAT: ilk eksikten sonra '/);
  });
});

describe('KT-03 O-5 provası yalnız yerel', () => {
  const sh = read('scripts/o5-upgrade-rehearsal.sh');
  test('yerel olmayan DB_URL çıkış 2, hiçbir şey çalıştırılmadan', () => {
    for (const url of ['postgresql://postgres:x@db.abc.supabase.co:5432/postgres', 'postgresql://u@127.0.0.1:5432/postgres?host=evil',
      'postgresql://u@127.0.0.1.evil.com/postgres']) {
      const r = spawnSync('bash', ['scripts/o5-upgrade-rehearsal.sh'], { cwd: root, env: { ...process.env, DB_URL: url, PATH: '/nonexistent:/usr/bin:/bin' }, encoding: 'utf8' });
      assert.equal(r.status, 2, url);
      assert.match(r.stderr, /YALITIM/);
    }
  });
  test('tek işlem, salt okunur tespit, KARAYS runbook, tutarsız şemada durur', () => {
    assert.match(sh, /sql -1 -f "supabase\/migrations\/\$f"/);
    assert.match(sh, /PGOPTIONS='-c default_transaction_read_only=on'/);
    assert.match(sh, /\[ "\$f" = 20261018000001_karays_brand\.sql \] && continue/);
    for (const f of ['01_preflight', '02_rollback_script', '03_apply', '04_postflight']) assert.ok(sh.includes(`karays_brand/${f}.sql`), f);
    assert.match(sh, /case "\$consist" in TAMAM\*\) ;; \*\) fail/);
    assert.doesNotMatch(sh, /supabase\.co|SUPABASE_DB_URL|secrets\./);
    assert.equal(spawnSync('bash', ['-n', 'scripts/o5-upgrade-rehearsal.sh'], { cwd: root }).status, 0);
  });
  test('canlı benzeri yığın TOTP\'yi açar (canlı ve CI ile aynı)', () => {
    assert.match(read('scripts/live-like-stack.sh'), /s\/enroll_enabled = false\/enroll_enabled = true\//);
  });
});
