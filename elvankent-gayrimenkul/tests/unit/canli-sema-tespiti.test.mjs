/**
 * KT-xx · KI-23 canlı şema tespiti (supabase/ops/canli_sema_tespiti.sql) ve O-5 yükseltme provası (scripts/o5-upgrade-rehearsal.sh).
 *
 *   KT-01  Tespit sorgusu tek bir SELECT: yazma / DDL / ayar / fonksiyon çağrısıyla yan etki yok; kişisel veri yazdırmaz.
 *   KT-02  31 migration'ın HER BİRİ ve 8 bekleyen dosyanın her biri tam bir kez, dosya sırasıyla listelenir (yeni migration
 *          eklenip tespit güncellenmezse test kırmızı olur).
 *   KT-03  O-5 provası yalnız yerel veritabanını kabul eder; dosyaları tek işlemde uygular (O-5a dosyası varsa o); KARAYS
 *          runbook'uyla gider; sonda migration geçmişini denetler; canlı benzeri yığın TOTP'yi canlıdaki gibi açar.
 *   KT-04  Migration geçmişi sorgusu (supabase/ops/canli_migration_gecmisi.sql) tek SELECT; beklenen değerler her migration için
 *          bir kez ve depo sırasıyla; O-5a özetleri dosyaların gerçek MD5'i.
 *   O5A-01 supabase/ops/o5a: tam 9 dosya, canlı tespitinde (01.11) YOK çıkan sırayla; gövde migration dosyasıyla BİREBİR aynı;
 *          sonda aynı işlemde geçmiş kaydı (ifade = dosyanın tamamı, ON CONFLICT yok); üretici --check ile güncel.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
    assert.match(sh, /src="supabase\/migrations\/\$f"/);
    assert.match(sh, /o5a=\$\(ls "\$OPS"\/o5a\/\[0-9\]\[0-9\]_"\$f"/);
    assert.match(sh, /sql -1 -f "\$src"/);
    assert.match(sh, /ro -f "\$OPS\/canli_migration_gecmisi\.sql"/);
    assert.match(sh, /\$3 == "FARKLI" \|\| \$3 == "İÇERİKSİZ" \|\| \$3 == "DEPODA YOK"/);
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

const O5A = ['20261002000001_karay_platform.sql', '20261004000001_design_family_access.sql', '20261005000001_office_site_management.sql',
  '20261006000001_brand_content_draft.sql', '20261007000001_seo_draft.sql', '20261008000001_owner_invitations.sql',
  '20261009000001_custom_domains.sql', '20261010000001_password_reset_requests.sql', '20261011000001_customer_operations.sql'];

describe('KT-04 migration geçmişi sorgusu', () => {
  const g = read('supabase/ops/canli_migration_gecmisi.sql');
  const gBody = g.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const gBare = gBody.replace(/\$o5a_dosya\$[\s\S]*?\$o5a_dosya\$/g, '').replace(/'(?:[^']|'')*'/g, "''");
  test('tek SELECT; yazma / DDL yok; ifade metni yazdırılmaz (yalnız sayı ve md5)', () => {
    assert.match(gBare.trim(), /^with expected\(version, name, n, md5\) as \(/);
    assert.equal((gBare.match(/;/g) ?? []).length, 1);
    for (const bad of [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bcreate\b/i, /\balter\b/i, /\bdrop\b/i, /\btruncate\b/i,
      /\bgrant\b/i, /\brevoke\b/i, /\bset\s+\w/i, /\bcopy\b/i, /set_config/i, /dblink/i]) assert.doesNotMatch(gBare, bad, String(bad));
    for (const m of gBody.matchAll(/\bstatements\b/g)) {
      const before = gBody.slice(Math.max(0, m.index - 16), m.index);
      assert.match(before, /(array_length|array_to_string)\($/, 'statements yalnız array_length / md5(array_to_string) içinde');
    }
    assert.match(gBody, /md5\(array_to_string\(statements, E'\\n'\)\)/);
  });
  test('beklenenler: 31 migration, her biri bir kez, depo sırasıyla; O-5a özetleri gerçek dosya MD5', () => {
    const exp = [...gBody.matchAll(/\('(\d{14})', '([a-z0-9_]+)', (\d+), '([0-9a-f]{32})'\)/g)];
    assert.deepEqual(exp.map((m) => `${m[1]}_${m[2]}.sql`), migrations);
    const o5a = [...gBody.matchAll(/\('(\d{14})', '([0-9a-f]{32})'\)/g)];
    assert.deepEqual(o5a.map((m) => m[1]), O5A.map((f) => f.slice(0, 14)));
    for (const [, v, h] of o5a) {
      const f = O5A.find((x) => x.startsWith(v));
      assert.equal(h, createHash('md5').update(read(`supabase/migrations/${f}`)).digest('hex'), f);
    }
  });
  test('durumlar: AYNI, O-5a kaydı, KARAYS runbook kaydı, FARKLI, İÇERİKSİZ, DEPODA YOK, KAYITSIZ', () => {
    for (const d of ["'AYNI'", "'AYNI (O-5a kaydı)'", "'AYNI (KARAYS runbook kaydı)'", "'FARKLI'", "'İÇERİKSİZ'", "'DEPODA YOK'", "'KAYITSIZ'"]) {
      assert.ok(gBody.includes(d), d);
    }
  });
});

describe('O5A-01 O-5a dosyaları = migration + aynı işlemde geçmiş kaydı', () => {
  const dir = path.join(root, 'supabase/ops/o5a');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  test('tam 9 dosya, canlı tespitindeki sırayla', () => {
    assert.deepEqual(files, O5A.map((f, i) => `${String(i + 1).padStart(2, '0')}_${f}`));
  });
  test('gövde migration ile birebir; sonda tek INSERT (ON CONFLICT yok), ifade = dosyanın tamamı', () => {
    for (const [i, f] of O5A.entries()) {
      const w = read(`supabase/ops/o5a/${files[i]}`);
      const src = read(`supabase/migrations/${f}`);
      const lines = w.split('\n');
      assert.ok(lines.slice(0, 5).every((l) => l.startsWith('-- ')), `${f}: 5 satırlık başlık`);
      const rest = lines.slice(5).join('\n');
      assert.ok(rest.startsWith(src), `${f}: gövde aynı`);
      const tail = rest.slice(src.length);
      const v = f.slice(0, 14);
      const n = f.slice(15, -4);
      assert.equal(tail, `\n-- ---- O-5a migration geçmişi kaydı (aynı işlem) ----\ninsert into supabase_migrations.schema_migrations (version, name, statements)\nvalues ('${v}', '${n}', array[$o5a_dosya$${src}$o5a_dosya$]);\n`, f);
      assert.doesNotMatch(src, /\$o5a_dosya\$/);
      assert.doesNotMatch(src, /^\s*(begin|commit|rollback|start transaction)\s*;/im, `${f}: kendi işlem komutu yok`);
    }
  });
  test('üretici --check: dosyalar güncel', () => {
    const r = spawnSync('bash', ['scripts/o5a-build.sh', '--check'], { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
});

/** Yorumları çıkar, tırnak içi metinleri ve dolar tırnaklı gövdeleri boşalt (yalnız SQL iskeleti kalır) */
const skeleton = (t) => t.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n').replace(/'(?:[^']|'')*'/g, "''");
const FORBIDDEN = [/\binsert\b/i, /\bupdate\b/i, /\bdelete\b/i, /\bcreate\b/i, /\balter\b/i, /\bdrop\b/i, /\btruncate\b/i,
  /\bgrant\b/i, /\brevoke\b/i, /\bset\s+\w/i, /\bcopy\b/i, /set_config/i, /dblink/i, /pg_terminate|pg_cancel|pg_reload|lo_import|lo_export/i];

describe('KT-05 köken sorgusu (canli_kayit_kokeni.sql): salt okunur, kişisel veri yok', () => {
  const k = read('supabase/ops/canli_kayit_kokeni.sql');
  const sk = skeleton(k);
  test('tek ifade, yazma / DDL / ayar yok', () => {
    assert.equal((sk.match(/;/g) ?? []).length, 1);
    for (const bad of FORBIDDEN) assert.doesNotMatch(sk, bad, String(bad));
  });
  test('statements içeriği değil yalnız NULL/uzunluk; demo tablosundan yalnız kurulum tarihi', () => {
    for (const m of k.matchAll(/\bstatements\b/g)) {
      const around = k.slice(m.index - 20, m.index + 20);
      assert.match(around, /(statements is null|array_length\(statements|statements NULL|statements boş|statements'ı|statements \+)/, around);
    }
    const inner = [...k.matchAll(/query_to_xml\(\s*'((?:[^']|'')*)'/g)].map((m) => m[1]);
    assert.deepEqual(inner, ['select min(created_at)::date::text as n from elvankent_demo.environment']);
  });
  test('0 katalog satırı BELİRSİZ sayılır, "ayrı yazıldı" denmez', () => {
    assert.match(k, /'BELİRSİZ: bu işlemin katalog satırı kalmamış'/);
    assert.doesNotMatch(skeleton(k).replace(/''/g, ''), /AYRI/);
    assert.doesNotMatch(k, /'AYRI İŞLEM/);
  });
});

describe('KT-06 şema ve güvenlik denetimi (canli_sema_denetimi.sql)', () => {
  const d = read('supabase/ops/canli_sema_denetimi.sql');
  const sk = skeleton(d);
  test('tek ifade, yazma / DDL / ayar yok; kullanıcı tablosu okunmaz (yalnız katalog + storage.buckets)', () => {
    assert.equal((sk.match(/;/g) ?? []).length, 1);
    for (const bad of FORBIDDEN) assert.doesNotMatch(sk, bad, String(bad));
    const froms = [...sk.matchAll(/\bfrom\s+([a-z_][a-z_.]*)/gi)].map((m) => m[1].toLowerCase());
    const allowed = new Set(['pg_class', 'pg_attribute', 'pg_attrdef', 'aclexplode', 'pg_roles', 'pg_policies', 'pg_proc', 'pg_constraint',
      'pg_trigger', 'pg_index', 'pg_type', 'storage.buckets', 'fp', 'exp', 'unnest', 'cmp', 'g', 'tenant_tables', 'pg_enum']);
    for (const f of froms) assert.ok(allowed.has(f) || f === 'select', `okunan kaynak: ${f}`);
  });
  test('beklenen değerler başvurudan üretilmiş: her kategori dolu, nesne başına bir kez', () => {
    const exp = [...d.matchAll(/^ {4}\('([a-z-ıüçşğö]+)', '((?:[^']|'')+)', '([0-9a-f]{32})'\)/gm)];
    assert.ok(exp.length >= 800, `beklenen sayısı ${exp.length}`);
    const keys = exp.map((m) => `${m[1]}|${m[2]}`);
    assert.equal(new Set(keys).size, keys.length, 'tekrar yok');
    const cats = new Set(exp.map((m) => m[1]));
    for (const c of ['tablo', 'tablo-yetki', 'politika', 'fonksiyon', 'fonksiyon-yetki', 'kısıt', 'tetikleyici', 'indeks', 'enum', 'kova']) {
      assert.ok(cats.has(c), c);
    }
    // Başvuru = 20261001000001'e kadar: sonraki migration'ların nesneleri beklenmez
    assert.ok(!keys.some((k) => /platform_settings|platform_org_notes|organization_invitations|karay_schema_version/.test(k)), 'başvuru canlının durumunda');
    assert.ok(keys.includes('tablo|site_configs') && keys.includes('fonksiyon|site_apply_brand(uuid,jsonb)'), '20260930000002 / 20261001000001 nesneleri var');
  });
  test('mutlak güvenlik kuralları G1–G4 ve search_path özeti', () => {
    for (const r of ["'G1'", "'G2'", "'G3'", "'G4'"]) assert.ok(d.includes(r), r);
    assert.match(d, /'HATA: RLS kapalı'/);
    assert.match(d, /current_setting\('search_path'\)/);
  });
  test('üretici yalnız yerel başvuruya bağlanır ve son kaydı 20261001000001 ister', () => {
    const r = spawnSync('bash', ['scripts/sema-denetimi-build.sh'], { cwd: root, env: { ...process.env, REF_DB_URL: 'postgresql://u@db.x.supabase.co:5432/postgres' }, encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(read('scripts/sema-denetimi-build.sh'), /\[ "\$v" = 20261001000001 \]/);
  });
});

describe('KT-07 KI-24 yolu ve CI', () => {
  test('restore-drill 9. adım: yalnız geçmişi 20261001000001 olan yedekte; G HATA → çıkış 3; SQL Editor search_path', () => {
    const r = read('scripts/restore-drill.sh');
    assert.match(r, /step "9\/9 KI-23 şema ve güvenlik denetimi/);
    assert.match(r, /if \[ "\$REG_LAST" = 20261001000001 \]/);
    assert.match(r, /-c 'set search_path = "\$user", public, extensions' -f "\$OPS\/canli_sema_denetimi\.sql"/);
    assert.match(r, /result "DENETIM_G=/);
    const i9 = r.indexOf('step "9/9'), iSema = r.lastIndexOf('result "SEMA=$sema"');
    assert.ok(i9 > 0 && iSema > i9, 'SEMA sonucu 9. adımdan sonra yazılır');
  });
  test('CI database: tam geçmiş + canlı denetim provası (DRILL_URL ile KI-24 yolu)', () => {
    const ci = read('../.github/workflows/elvankent-ci.yml');
    const db = ci.slice(ci.indexOf('\n  database:\n'), ci.indexOf('\n  database-legacy-schema:\n'));
    assert.match(db, /checkout@[0-9a-f]{40} # v7\.0\.1\n {8}with:\n[^\n]*\n {10}fetch-depth: 0/);
    assert.match(db, /DRILL_URL=postgresql:\/\/supabase_admin:postgres@127\.0\.0\.1:54322\/postgres bash scripts\/canli-denetim-prova\.sh/);
  });
  test('prova betiği: tarihî paketler sabit commit\'lerden, beklenen canlı çıktı, 6 negatif kontrol', () => {
    const p = read('scripts/canli-denetim-prova.sh');
    for (const c of ['f760625:01_v1_schema', 'f760625:03_v2_stage3', 'd721428:06_platform_updates']) assert.ok(p.includes(c), c);
    assert.match(p, /İÇERİKSİZ=21, KAYITSIZ=10/);
    assert.equal((p.match(/^neg '/gm) ?? []).length, 6);
    assert.equal(spawnSync('bash', ['-n', 'scripts/canli-denetim-prova.sh'], { cwd: root }).status, 0);
  });
});
