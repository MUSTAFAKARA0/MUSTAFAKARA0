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
import { readFileSync, readdirSync, writeFileSync, rmSync, mkdtempSync, mkdirSync } from 'node:fs';
import os from 'node:os';
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
    // Sıra (kategori, özet, nesne): özet adın ÖNÜNDE (CI #147: "…_key', '<hex>'" gizli anahtar sanıldı)
    const exp = [...d.matchAll(/^ {4}\('([a-z-ıüçşğö]+)', '([0-9a-f]{32})', '((?:[^']|'')+)'\)/gm)];
    assert.ok(exp.length >= 800, `beklenen sayısı ${exp.length}`);
    assert.doesNotMatch(d, /^ {4}\('[^']+', '[^']+', '[0-9a-f]{32}'\)/m, 'özet sonda olmamalı');
    const keys = exp.map((m) => `${m[1]}|${m[3]}`);
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

describe('KT-08 gitleaks yok sayma listesi yalnız CI #147 yanlış alarmları', () => {
  test('her satır: commit 2d71287 + canli_sema_denetimi.sql + iki kural; başka commit/dosya yok; tarama gevşetilmedi', () => {
    const lines = read('../.gitleaksignore').split('\n').filter((l) => l && !l.startsWith('#'));
    assert.equal(lines.length, 141);
    for (const l of lines) {
      assert.match(l, /^2d712879441b8af24ba37a03bc5ae342264b85b7:elvankent-gayrimenkul\/supabase\/ops\/canli_sema_denetimi\.sql:(generic-api-key|facebook-secret):\d+$/, l);
    }
    const ci = read('../.github/workflows/elvankent-ci.yml');
    assert.match(ci, /\.\/gitleaks git \. --log-opts="-- elvankent-gayrimenkul" --no-banner --redact --exit-code 1\n/);
    assert.doesNotMatch(ci, /gitleaks[^\n]*(--config|--baseline|--ignore-gitleaks-allow|--max-target|--log-level error)/);
  });
});

describe('KT-09 canlı denetim iş akışı (elvankent-ki23-canli-denetim.yml) ve betiği', () => {
  const wf = read('../.github/workflows/elvankent-ki23-canli-denetim.yml');
  const sh = read('scripts/ki23-canli-denetim.sh');
  const code = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  test('tetik: yalnız workflow_dispatch + istek dosyası (çalışma dalı); sahip; geliştirme commit\'i değil; CALISTIR=evet', () => {
    const on = wf.slice(wf.indexOf('\non:\n'), wf.indexOf('\npermissions:'));
    assert.equal(on, "\non:\n  workflow_dispatch: {}\n  push:\n    branches: ['claude/karays-mission-control-vn8g65']\n    paths: ['elvankent-gayrimenkul/ops-requests/ki23-canli-denetim.request']\n");
    assert.match(wf, /if: \$\{\{ github\.actor == github\.repository_owner && github\.run_attempt == 1 && \(github\.event_name == 'workflow_dispatch' \|\| !contains\(github\.event\.head_commit\.message, 'Claude-Session:'\)\) \}\}/);
    // Tek kullanımlık: push'ta önceki ↔ yeni commit karşılaştırması (tam geçmiş, kimlik bilgisi saklanmaz)
    assert.match(wf, /fetch-depth: 0\n {10}persist-credentials: false/);
    assert.match(wf, /if: \$\{\{ github\.event_name == 'push' \}\}\n {8}env:\n {10}ONCEKI: \$\{\{ github\.event\.before \}\}\n {10}YENI: \$\{\{ github\.sha \}\}\n {8}run: bash scripts\/ki23-tetik-kontrol\.sh "\$ONCEKI" "\$YENI"/);
    assert.ok(wf.indexOf('ki23-tetik-kontrol.sh') < wf.indexOf('secrets.SUPABASE_DB_URL'), 'tetik kontrolü sırdan önce');
    // İstek dosyasını sahip açabilir ya da kapatabilir (açmak normal kullanımdır, CI #154): tam bir CALISTIR satırı vardır.
    // Koruma dosyanın o anki hâli değil, tetik kuralıdır (kapalı → açık geçişi, KT-10) ve geliştirme commit'lerinin dışlanması.
    const req = read('ops-requests/ki23-canli-denetim.request').split('\n');
    const lines = req.filter((l) => /CALISTIR=evet/.test(l) && !/^#\s{2,}/.test(l) && !/"# CALISTIR=evet"/.test(l));
    assert.equal(lines.length, 1, 'tek CALISTIR satırı');
    assert.match(lines[0], /^(# )?CALISTIR=evet$|^\s+CALISTIR=evet\s*$/, 'satır açık ya da kapalı, başka içerik yok');
    assert.doesNotMatch(req.join('\n'), /postgres(ql)?:\/\/|SUPABASE_DB_URL=|password|parola=/i, 'istek dosyasında sır yok');
  });
  test('izin ve sırlar: contents: read; yalnız SUPABASE_DB_URL; artifact/cache/set -x yok; kimlik bilgisi saklanmaz', () => {
    assert.match(wf, /\npermissions:\n  contents: read\n\n/);
    const secrets = [...code(wf).matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(secrets)], ['SUPABASE_DB_URL']);
    assert.doesNotMatch(code(wf), /upload-artifact|actions\/cache|set -x|ACTIONS_STEP_DEBUG|echo "\$DENETIM_DB_URL|\$\{\{ secrets\.[A-Z_]+ \}\}[^\n]*run:/);
    assert.match(wf, /persist-credentials: false/);
    assert.match(wf, /DENETIM_DB_URL: \$\{\{ secrets\.SUPABASE_DB_URL \}\}\n {8}run: bash scripts\/ki23-canli-denetim\.sh\n/);
  });
  test('denetim dosyası SHA-256 ile sabit ve bugünkü dosyayla aynı', () => {
    const pinned = wf.match(/DENETIM_SQL_SHA256: ([0-9a-f]{64})/)?.[1];
    const actual = createHash('sha256').update(readFileSync(path.join(root, 'supabase/ops/canli_sema_denetimi.sql'))).digest('hex');
    assert.equal(pinned, actual);
  });
  test('betik: salt okunur başlangıç, doğrulama, maske, ham hata yok, yalnız sayılar', () => {
    const c = code(sh);
    assert.match(c, /export PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=\d+ -c lock_timeout=\d+ -c idle_in_transaction_session_timeout=\d+'/);
    // Güvenlik kapısı = gerçek işlemin transaction_read_only değeri (aynı bağlantı, aynı işlem); varsayılan ayar yalnız bilgi
    assert.match(c, /if \[ "\$tro" != on \] \|\| grep -q '\^KONTROL\|DENETIM GONDERILMEDI' "\$T\/out"; then\n {2}die 3 "İşlem salt okunur değil/);
    assert.doesNotMatch(c, /"\$dro" != on/, 'varsayılan ayar kapı değil');
    // Tek bağlantı, tek işlem: yalnız BİR psql çağrısı; BEGIN READ ONLY → kontrol → \if → \i → ROLLBACK
    assert.equal((c.match(/^\s*psql "\$DENETIM_DB_URL"/gm) ?? []).length, 1, 'tek psql bağlantısı');
    const w = sh.slice(sh.indexOf('# SARMALAYICI-BAS'), sh.indexOf('# SARMALAYICI-SON'));
    const order = ['\\set ON_ERROR_STOP 1', 'BEGIN READ ONLY;', "current_setting('transaction_read_only') = 'on' AS ro_tamam", '\\gset', '\\if :ro_tamam', "\\i '$1'", '\\else', '\\endif', 'ROLLBACK;'];
    let at = -1;
    for (const o of order) { const i = w.indexOf(o); assert.ok(i > at, `sarmalayıcı sırası: ${o}`); at = i; }
    assert.doesNotMatch(w, /\bCOMMIT\b|\bEND\b;/);
    assert.match(w, /SELECT current_setting\('transaction_read_only'\) = 'on' AS ro_tamam,\n/, 'kapı yalnız işlemin değeri');
    assert.doesNotMatch(w, /default_transaction_read_only'\) = 'on'/, 'varsayılan ayar kapıya girmez');
    assert.match(c, /printf '::add-mask::%s\\n' "\$DENETIM_DB_URL"/);
    assert.match(c, /-v VERBOSITY=sqlstate/);
    assert.doesNotMatch(c, /set -x|cat "\$T\/err"|cat "\$T\/out"|tee |\$DENETIM_DB_URL"? *>>|echo "\$DENETIM_DB_URL/);
    // günlüğe giden her satır say/die üzerinden; ham çıktı satırı (nesne adı) yazdırılmaz
    assert.doesNotMatch(c, /awk[^\n]*print \$2/);
    assert.ok(c.indexOf('node scripts/ki23-denetim-guard.mjs') < c.indexOf('psql "$DENETIM_DB_URL"'), 'bekçi bağlantıdan önce');
    assert.ok(c.indexOf('[ "$actual" = "$DENETIM_SQL_SHA256" ]') < c.indexOf('psql "$DENETIM_DB_URL"'), 'SHA bağlantıdan önce');
    assert.equal(spawnSync('bash', ['-n', 'scripts/ki23-canli-denetim.sh'], { cwd: root }).status, 0);
  });
  test('bekçi: bugünkü dosya geçer; yazma / çoklu ifade / dolar gövdesi / ayar / meta komut reddedilir', () => {
    const g = (file) => spawnSync('node', ['scripts/ki23-denetim-guard.mjs', file], { cwd: root, encoding: 'utf8' });
    assert.equal(g('supabase/ops/canli_sema_denetimi.sql').status, 0);
    const base = read('supabase/ops/canli_sema_denetimi.sql');
    const tmp = path.join(os.tmpdir(), `ki23-bekci-${process.pid}.sql`);
    for (const [name, text] of [
      ['ikinci ifade', base.replace(/order by 1, 2;\s*$/, 'order by 1, 2; select 1;')],
      ['delete', base.replace(/order by 1, 2;\s*$/, 'order by 1, 2; delete from public.leads;')],
      ['dolar gövdesi', base.replace('with\n', "with x as (select $q$ drop table t $q$),\n")],
      ['set_config', base.replace("current_setting('search_path')", "set_config('search_path', '', false)")],
      ['meta komut', '\\! id\n' + base],
      ['satır içi yorum', base.replace('select ', 'select /* x */ ')],
    ]) {
      writeFileSync(tmp, text);
      const r = g(tmp);
      assert.equal(r.status, 2, name);
      assert.doesNotMatch(r.stderr + r.stdout, /leads|drop table/, `${name}: SQL metni yazılmaz`);
    }
    rmSync(tmp, { force: true });
  });
});

describe('KT-10 tek kullanımlık tetik (scripts/ki23-tetik-kontrol.sh)', () => {
  test('yalnız kapalı → açık geçişi çalıştırır; açık → açık, kapanış, bilinmeyen geçmiş ve geçersiz girdi çalıştırmaz', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'ki23-tetik-'));
    const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
    git('init', '-q');
    const f = path.join(dir, 'elvankent-gayrimenkul/ops-requests');
    mkdirSync(f, { recursive: true });
    const commit = (body) => { writeFileSync(path.join(f, 'ki23-canli-denetim.request'), body); git('add', '-A'); git('commit', '-qm', 'x'); return git('rev-parse', 'HEAD').stdout.trim(); };
    const c0 = commit('# açıklama\n# CALISTIR=evet\n');
    const c1 = commit('# açıklama\nCALISTIR=evet\n');
    const c2 = commit('# açıklama (düzenlendi)\nCALISTIR=evet\n');
    const c3 = commit('# açıklama\n# CALISTIR=evet\n');
    const c4 = commit('# açıklama\nCALISTIR=evet\n');
    const c5 = commit('# açıklama\nCALISTIR=evet  \n');
    const zero = '0'.repeat(40);
    const run = (b, a) => spawnSync('bash', [path.join(root, 'scripts/ki23-tetik-kontrol.sh'), b, a], { cwd: dir, encoding: 'utf8' }).status;
    assert.equal(run(c0, c1), 0, 'kapalı → açık: çalıştır');
    assert.equal(run(c1, c2), 1, 'açık → açık (sıradan düzenleme): çalıştırma');
    assert.equal(run(c2, c3), 1, 'açık → kapalı: çalıştırma');
    assert.equal(run(c3, c4), 0, 'kapat → yeniden aç: açık yeniden tetikleme');
    assert.equal(run(c4, c5), 1, 'açık → açık (boşluk eklenmiş, satır artık tam eşleşmiyor): çalıştırma');
    assert.equal(run(c0, c2), 0, 'çok commit\'li gönderim: önceki kapalı, son açık');
    assert.equal(run(zero, c1), 0, 'yeni dal: önceki kapalı sayılır');
    assert.equal(run(zero, c0), 1, 'yeni dal, satır kapalı');
    assert.equal(run('f'.repeat(40), c1), 1, 'önceki commit geçmişte yok: güvenli taraf');
    assert.equal(run('abc', c1), 1, 'geçersiz önceki');
    assert.equal(run(c0, 'xyz'), 1, 'geçersiz yeni');
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('KT-11 fonksiyon farkı teşhisi (canli_fonksiyon_teshis.sql) ve KI-24 K6 sertleştirmesi', () => {
  const t = read('supabase/ops/canli_fonksiyon_teshis.sql');
  const wf = read('../.github/workflows/elvankent-ki23-canli-denetim.yml');
  test('teşhis: bekçiden geçer; yalnız katalog; yalnız sayı döner; özet adın önünde; 77 fonksiyon', () => {
    assert.equal(spawnSync('node', ['scripts/ki23-denetim-guard.mjs', 'supabase/ops/canli_fonksiyon_teshis.sql'], { cwd: root }).status, 0);
    const body = t.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
    const sk = body.replace(/'(?:[^']|'')*'/g, "''");
    const froms = [...sk.matchAll(/\bfrom\s+([a-z_][a-z_.]*)/gi)].map((m) => m[1].toLowerCase());
    for (const f of froms) assert.ok(['pg_proc', 'exp', 'cur', 'e', 'j', 'unnest'].includes(f), `kaynak: ${f}`);
    // Çıktıda imza / gövde yok: son SELECT'ler yalnız sayım
    const tail = body.slice(body.indexOf("select 'TESHIS'"));
    assert.doesNotMatch(tail, /prosrc|imza\s*(,|$)|h_govde\s*(,|$)/m);
    const exp = [...t.matchAll(/^ {4}\('([0-9a-f]{32})', '([0-9a-f]{32})', '([^']+)'\)/gm)];
    assert.equal(exp.length, 77);
    assert.doesNotMatch(t, /^ {4}\('[^']+', '[^']+', '[0-9a-f]{32}'\)/m, 'özet sonda değil');
  });
  test('iş akışı teşhis dosyasını da SHA-256 ile sabitler; betik ikisini aynı işlemde çalıştırır', () => {
    const pinned = wf.match(/DENETIM_TESHIS_SHA256: ([0-9a-f]{64})/)?.[1];
    assert.equal(pinned, createHash('sha256').update(readFileSync(path.join(root, 'supabase/ops/canli_fonksiyon_teshis.sql'))).digest('hex'));
    const sh = read('scripts/ki23-canli-denetim.sh');
    assert.match(sh, /\[ "\$t_actual" = "\$DENETIM_TESHIS_SHA256" \] \|\| die 2/);
    assert.match(sh, /node scripts\/ki23-denetim-guard\.mjs "\$TESHIS"/);
    assert.match(sh, /wrapper "\$SQL" "\$TESHIS" > "\$T\/run\.sql"/);
    const w = sh.slice(sh.indexOf('# SARMALAYICI-BAS'), sh.indexOf('# SARMALAYICI-SON'));
    assert.ok(w.indexOf("\\i '$1'") < w.indexOf("${2:+\\\\i '$2'}") && w.indexOf("${2:+\\\\i '$2'}") < w.indexOf('\\else'), 'teşhis kapının içinde, denetimden sonra');
    // "TAMAM (biçim farkı)" yalnız: G temiz, EKSİK/FAZLA yok, tüm farklar fonksiyon ve teşhis hepsini açıklıyor
    assert.match(sh, /\[ "\$tot_farkli" = "\$fn_farkli" \]/);
    assert.match(sh, /\[ "\$t_bas" = "\$t_bek" \] && \[ "\$t_cr" = "\$t_bek" \]/);
  });
  test('KI-24 K6: listeleme hatası sessiz geçmez; seçilen her dosya doğrulanmalı (hedef 20 + 5)', () => {
    const r = read('../.github/workflows/elvankent-restore-drill.yml');
    const k6 = r.slice(r.indexOf('- name: Storage örneği (K6'), r.indexOf('- name: Temizlik'));
    assert.doesNotMatch(k6, /> "\$RUNNER_TEMP\/k6-\$b\.all" \|\| true/);
    assert.match(k6, /for spec in media-originals:20 branding:5; do/);
    assert.match(k6, /--min="\$\(\( hedef > 0 \? hedef : 1 \)\)"/);
    assert.match(k6, /if \[ "\$\{dosya:-0\}" != "\$hedef" \] \|\| \[ "\$\{ayni:-0\}" != "\$hedef" \]; then/);
    const d = read('scripts/restore-drill.sh');
    assert.match(d, /result "DENETIM_FONKSIYON=\$\(\[ "\$tha" = "\$tb" \] && echo AYNI \|\| echo BICIM\)"/);
  });
});
