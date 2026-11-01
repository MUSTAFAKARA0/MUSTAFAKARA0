/**
 * KI-24 · geri yükleme tatbikatı (scripts/restore-drill.sh) — sahte psql / pg_restore ile GERÇEKTEN çalıştırılır (ağ yok).
 *
 *   RD-01  Yalıtım: yalnız yerel test sunucusu (127.0.0.1 / localhost / [::1]); sorgu parametresi, uzak adres ve hedefi
 *          değiştirebilen libpq ortam değişkenleri reddedilir — bu durumlarda HİÇBİR veritabanı aracı çağrılmaz (çıkış 2).
 *          Bağlantıdan sonra sunucu kendini genel ağ adresiyle görüyorsa da durur (yerel Docker köprü adresi kabul).
 *   RD-02  Ayrı kontroller: BÜTÜNLÜK (SHA-256, dump, tek işlem geri yükleme, parmak izi, tablo sayıları) ile ŞEMA UYGUNLUĞU
 *          (şema sürümü, bekleyen dosyalar, postflight) ayrı raporlanır. Canlıda henüz uygulanmamış migration'lar ve
 *          supabase/pending dosyaları BİLGİ'dir, başarısızlık değildir. Çıkış: 0 tamam · 1 bütünlük · 3 şema/güvenlik.
 *   RD-03  İş akışları: CI'da sentetik kuru prova (scripts/restore-drill-synthetic.sh, yalnız yerel); gerçek veri iş akışı
 *          yalnız sahip onayı + değişken + korumalı ortamla, canlı sır yok, R2 yalnız okunur.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(path.join(root, p), 'utf8');
const SCRIPT = path.join(root, 'scripts/restore-drill.sh');
const LATEST = readdirSync(path.join(root, 'supabase/migrations')).filter((f) => /^\d{14}_/.test(f)).sort().at(-1).slice(0, 14);
const PENDING = readdirSync(path.join(root, 'supabase/pending')).filter((f) => f.endsWith('.sql')).length;

// Sahte psql: hangi dosya/komut istendiğine göre hazır çıktı verir; her çağrıyı kaydeder
const FAKE_PSQL = `#!/usr/bin/env bash
echo "psql $*" >> "$FAKE_LOG"
args="$*"
case "$args" in
  *inet_server_addr*) printf '%s\\n' "\${FAKE_SERVER_ADDR-127.0.0.1}"; exit 0 ;;
  *karay_schema_version*) printf '%s\\n' "\${FAKE_VERSION-${LATEST}}"; exit 0 ;;
  *backup_fingerprint.sql*) cat "$FAKE_DIR/restored.fingerprint.txt"; exit 0 ;;
  *backup_table_counts.sql*) cat "$FAKE_DIR/restored.tables.txt"; exit 0 ;;
  *postflight_v2.sql*) cat "$FAKE_DIR/postflight.txt"; exit 0 ;;
  *"create database"*|*"drop database"*) exit 0 ;;
esac
exit 0
`;
const FAKE_PG_RESTORE = `#!/usr/bin/env bash
echo "pg_restore $*" >> "$FAKE_LOG"
exit 0
`;

const STAMP = '2026-11-01T0423Z';
const FP = '1|organizations|2 | abc\n2|properties|12 | def\n';
const TABLES = 'public.organizations | 2\npublic.properties | 12\n';

function setup(t, { fp = FP, restoredFp = FP, tables = TABLES, restoredTables = TABLES, postflight = '1|tablolar|20 / 20|TAMAM\n2|ilanlar|12|preflight ile KARŞILAŞTIRIN\n', corrupt = false } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'karay-drill-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  const backup = path.join(dir, 'yedek');
  mkdirSync(bin);
  mkdirSync(backup);
  writeFileSync(path.join(bin, 'psql'), FAKE_PSQL);
  writeFileSync(path.join(bin, 'pg_restore'), FAKE_PG_RESTORE);
  chmodSync(path.join(bin, 'psql'), 0o755);
  chmodSync(path.join(bin, 'pg_restore'), 0o755);
  const name = `db-${STAMP}`;
  writeFileSync(path.join(backup, `${name}.dump`), 'PGDMP sentetik');
  writeFileSync(path.join(backup, `${name}.fingerprint.txt`), fp);
  writeFileSync(path.join(backup, `${name}.tables.txt`), tables);
  const sum = (f) => createHash('sha256').update(readFileSync(path.join(backup, f))).digest('hex');
  const files = [`${name}.dump`, `${name}.fingerprint.txt`, `${name}.tables.txt`];
  writeFileSync(path.join(backup, `${name}.sha256`), files.map((f) => `${sum(f)}  ${f}`).join('\n') + '\n');
  if (corrupt) writeFileSync(path.join(backup, `${name}.dump`), 'PGDMP bozuk');
  writeFileSync(path.join(dir, 'restored.fingerprint.txt'), restoredFp);
  writeFileSync(path.join(dir, 'restored.tables.txt'), restoredTables);
  writeFileSync(path.join(dir, 'postflight.txt'), postflight);
  const log = path.join(dir, 'calls.log');
  writeFileSync(log, '');
  const run = (url, env = {}) => {
    const r = spawnSync('bash', ['--noprofile', '--norc', SCRIPT, backup, STAMP], {
      env: { PATH: `${bin}:/usr/bin:/bin`, ADMIN_DB_URL: url, FAKE_LOG: log, FAKE_DIR: dir, DRILL_RESULT: path.join(dir, 'result.txt'), ...env },
      encoding: 'utf8',
    });
    return {
      status: r.status,
      out: r.stdout + r.stderr,
      calls: readFileSync(log, 'utf8'),
      result: existsSync(path.join(dir, 'result.txt')) ? readFileSync(path.join(dir, 'result.txt'), 'utf8') : '',
    };
  };
  return { run };
}
const LOCAL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

describe('RD-01 yalıtım: yalnız yerel test veritabanı', () => {
  const refused = [
    ['canlı Supabase doğrudan bağlantı', 'postgresql://postgres:x@db.abcdefghijklmnopqrst.supabase.co:5432/postgres'],
    ['Supabase oturum havuzu', 'postgresql://postgres.abc:x@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'],
    ['özel ağ adresi', 'postgresql://postgres@10.0.0.5:5432/postgres'],
    ['yerel ad + ?host= ile yönlendirme', 'postgresql://postgres@localhost:5432/postgres?host=db.example.com'],
    ['yerel ad + ?hostaddr=', 'postgresql://postgres@127.0.0.1:5432/postgres?hostaddr=203.0.113.9'],
    ['service= parametresi', 'postgresql://127.0.0.1/postgres?service=prod'],
    ['localhost önekli uzak ad', 'postgresql://postgres@localhost.evil.example:5432/postgres'],
    ['birden çok ana makine', 'postgresql://postgres@127.0.0.1,db.example.com:5432/postgres'],
    ['veritabanı adı yok', 'postgresql://postgres@127.0.0.1:5432'],
    ['anahtar=değer biçimi', 'host=127.0.0.1 dbname=postgres'],
  ];
  for (const [name, url] of refused) {
    test(`reddedilir: ${name}`, (t) => {
      const r = setup(t).run(url);
      assert.equal(r.status, 2, r.out);
      assert.match(r.out, /YALITIM/);
      assert.equal(r.calls, '', 'hiçbir veritabanı aracı çağrılmamalı');
    });
  }
  for (const env of [{ PGHOSTADDR: '203.0.113.9' }, { PGSERVICE: 'prod' }, { PGSERVICEFILE: '/tmp/x' }]) {
    test(`reddedilir: hedefi değiştirebilen ortam değişkeni ${Object.keys(env)[0]}`, (t) => {
      const r = setup(t).run(LOCAL, env);
      assert.equal(r.status, 2, r.out);
      assert.equal(r.calls, '');
    });
  }
  for (const addr of ['203.0.113.9', '2001:db8::5', '8.8.8.8']) {
    test(`bağlantıdan sonra sunucu adresi genel ağda (${addr}) ise durur; veritabanı oluşturulmaz`, (t) => {
      const r = setup(t).run(LOCAL, { FAKE_SERVER_ADDR: addr });
      assert.equal(r.status, 2, r.out);
      assert.match(r.out, /YALITIM.*genel ağ/);
      assert.doesNotMatch(r.calls, /create database/);
    });
  }
  // Yerel Supabase Docker'da çalışır: loopback port yönlendirmesiyle bağlanılır, sunucu kendini köprü ağı adresiyle görür
  for (const addr of ['172.18.0.7', '10.1.2.3', '192.168.1.4', 'fd00::7']) {
    test(`kabul edilir: loopback bağlantısı, sunucu konteyner/özel ağ adresinde (${addr})`, (t) => {
      const r = setup(t).run(LOCAL, { FAKE_SERVER_ADDR: addr });
      assert.equal(r.status, 0, r.out);
    });
  }
  for (const url of [LOCAL, 'postgresql://postgres:postgres@localhost:54322/postgres', 'postgres://postgres@[::1]:5432/postgres']) {
    test(`kabul edilir: ${url.replace(/:[^:@]*@/, ':***@')}`, (t) => {
      const r = setup(t).run(url, url.includes('[::1]') ? { FAKE_SERVER_ADDR: '::1' } : {});
      assert.equal(r.status, 0, r.out);
    });
  }
  test('unix soketi (sunucu adresi boş) kabul edilir', (t) => {
    const r = setup(t).run(LOCAL, { FAKE_SERVER_ADDR: '' });
    assert.equal(r.status, 0, r.out);
  });
});

describe('RD-02 bütünlük ve şema uygunluğu ayrı', () => {
  test('her şey yolunda: çıkış 0; iki ayrı satır; sonuç dosyası', (t) => {
    const r = setup(t).run(LOCAL);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /BÜTÜNLÜK: TAMAM/);
    assert.match(r.out, /ŞEMA: TAMAM/);
    assert.match(r.result, /^BUTUNLUK=TAMAM$/m);
    assert.match(r.result, /^SEMA=TAMAM$/m);
    assert.match(r.result, new RegExp(`^SEMA_SURUM=${LATEST}$`, 'm'));
  });
  test('canlıda henüz uygulanmamış migration (eski şema sürümü) başarısızlık DEĞİL: BİLGİ, çıkış 0', (t) => {
    const r = setup(t).run(LOCAL, { FAKE_VERSION: '20261011000001' });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /BÜTÜNLÜK: TAMAM/);
    assert.match(r.out, /ŞEMA: BİLGİ — yedeğin şeması depodaki son migration'dan geride/);
    assert.match(r.result, /^SEMA=BILGI$/m);
  });
  test('bekleyen (pending) dosyalar yalnız bilgi olarak yazılır', (t) => {
    const r = setup(t).run(LOCAL);
    assert.match(r.out, new RegExp(`${PENDING} bekleyen dosya \\(supabase/pending\\).*uygunluk ölçütü değil`));
  });
  test('parmak izi farkı BÜTÜNLÜK hatasıdır: çıkış 1, şema değerlendirilmez', (t) => {
    const r = setup(t, { restoredFp: FP.replace('def', 'xyz') }).run(LOCAL);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /BÜTÜNLÜK: HATA/);
    assert.doesNotMatch(r.out, /ŞEMA:/);
    assert.match(r.result, /^BUTUNLUK=HATA$/m);
  });
  test('tablo sayısı farkı BÜTÜNLÜK hatasıdır', (t) => {
    const r = setup(t, { restoredTables: TABLES.replace('| 12', '| 11') }).run(LOCAL);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /BÜTÜNLÜK: HATA/);
  });
  test('SHA-256 uyuşmazsa veritabanı hiç oluşturulmaz', (t) => {
    const r = setup(t, { corrupt: true }).run(LOCAL);
    assert.equal(r.status, 1, r.out);
    assert.doesNotMatch(r.calls, /create database/);
  });
  test('postflight HATA: bütünlük TAMAM, ŞEMA HATA, çıkış 3 (ayrı kontrol)', (t) => {
    const r = setup(t, { postflight: '1|tablolar|20 / 20|TAMAM\n2|RLS|-|HATA: RLS kapalı tablo var\n' }).run(LOCAL);
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /BÜTÜNLÜK: TAMAM/);
    assert.match(r.out, /ŞEMA: HATA/);
    assert.match(r.result, /^BUTUNLUK=TAMAM$/m);
    assert.match(r.result, /^SEMA=HATA$/m);
  });
  const GAP = '1|tablolar|20 / 20|TAMAM\n27|KARAYS marka geçişi|KARAY|HATA: 20261018000001_karays_brand.sql uygulanmamış\n26|Müşteri operasyonları|0 not|HATA: şema sürümü eski\n';
  test('postflight "…uygulanmamış" / "şema sürümü eski" satırları, şema geride iken migration gecikmesidir: BİLGİ, çıkış 0', (t) => {
    const r = setup(t, { postflight: GAP }).run(LOCAL, { FAKE_VERSION: '20261011000001' });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /2 satır migration gecikmesi/);
    assert.match(r.out, /ŞEMA: BİLGİ/);
    assert.match(r.result, /^BUTUNLUK=TAMAM$/m);
    assert.match(r.result, /^SEMA=BILGI$/m);
  });
  test('aynı satırlar şema sürümü güncelken gerçek HATA sayılır (çıkış 3)', (t) => {
    const r = setup(t, { postflight: GAP }).run(LOCAL);
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /ŞEMA: HATA/);
  });
  test('şema geride olsa da güvenlik hatası (RLS) gizlenmez: çıkış 3', (t) => {
    const r = setup(t, { postflight: GAP + '2|RLS|-|HATA: RLS kapalı tablo var\n' }).run(LOCAL, { FAKE_VERSION: '20261011000001' });
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /ŞEMA: HATA — son kontrolde 1 /);
  });
  // Canlının gerçek durumu (sahip, 01.11): karay_schema_version() yok (FAKE_VERSION=''), birden çok migration eksik
  const LIVE = '1|tablolar|20 / 20|TAMAM\n2|RLS|yok|TAMAM\n14|Kiracı listesi|0 açık politika|TAMAM\n'
    + '25|Şema sürümü|sürüm yok|HATA: 20261010000001_password_reset_requests.sql uygulanmamış\n'
    + '26|Müşteri operasyonları|not tablosu yok|HATA: 20261011000001_customer_operations.sql uygulanmamış\n'
    + '27|KARAYS marka geçişi|KARAY|HATA: 20261018000001_karays_brand.sql uygulanmamış\n';
  test('canlı durumu: sürüm fonksiyonu yok + son 3 migration eksik → BÜTÜNLÜK TAMAM, ŞEMA BİLGİ, çıkış 0', (t) => {
    const r = setup(t, { postflight: LIVE }).run(LOCAL, { FAKE_VERSION: '' });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /3 satır migration gecikmesi/);
    assert.match(r.out, /ŞEMA: BİLGİ — şema sürümü fonksiyonu yok; son kontrole göre ilk eksik migration 20261010000001/);
    assert.match(r.result, /^BUTUNLUK=TAMAM$/m);
    assert.match(r.result, /^SEMA=BILGI$/m);
    assert.match(r.result, /^SEMA_SURUM=yok$/m);
    assert.match(r.result, /^SEMA_ILK_EKSIK=20261010000001$/m);
  });
  test('canlı durumu + RLS kapalı tablo: gizlenmez (çıkış 3)', (t) => {
    const r = setup(t, { postflight: LIVE.replace('2|RLS|yok|TAMAM', '2|RLS|properties|HATA: RLS kapalı tablo var') }).run(LOCAL, { FAKE_VERSION: '' });
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /BÜTÜNLÜK: TAMAM/);
    assert.match(r.out, /ŞEMA: HATA — son kontrolde 1 /);
  });
  test('canlı durumu + istemciye açık fonksiyon: gizlenmez (çıkış 3)', (t) => {
    const r = setup(t, { postflight: LIVE + '23|Sahip daveti|0|HATA: davet fonksiyonları istemciye açık veya eksik\n' }).run(LOCAL, { FAKE_VERSION: '' });
    assert.equal(r.status, 3, r.out);
  });
  test('tutarsız eksik: arada bir migration "uygulanmamış" ama sonrakiler uygulanmış (ör. açık politika) → HATA', (t) => {
    const r = setup(t, { postflight: LIVE.replace('14|Kiracı listesi|0 açık politika|TAMAM', '14|Kiracı listesi|1 açık politika|HATA: 20260929000001_platform_owner_isolation.sql uygulanmamış') }).run(LOCAL, { FAKE_VERSION: '' });
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /eksikler tutarsız: 20260929000001 eksik görünüyor/);
    assert.match(r.result, /^SEMA=HATA$/m);
  });
  test('tutarsız eksik: sürüm 20261011000001 diyor ama 20261010000001 "uygulanmamış" → HATA', (t) => {
    const r = setup(t, { postflight: LIVE }).run(LOCAL, { FAKE_VERSION: '20261011000001' });
    assert.equal(r.status, 3, r.out);
    assert.match(r.out, /şema sürümü 20261011000001, 20261010000001 uygulanmış olmalıydı/);
  });
  test('sürüm fonksiyonu yokken "şema sürümü eski" satırı beklenmez → HATA', (t) => {
    const r = setup(t, { postflight: LIVE + '28|x|y|HATA: şema sürümü eski\n' }).run(LOCAL, { FAKE_VERSION: '' });
    assert.equal(r.status, 3, r.out);
  });
  test('geçici veritabanı her durumda silinir (başarı ve bütünlük hatası)', (t) => {
    for (const opts of [{}, { restoredFp: 'farklı\n' }]) {
      const r = setup(t, opts).run(LOCAL);
      assert.match(r.calls, /drop database if exists "karay_restore_drill_/);
    }
  });
});

describe('RD-03 iş akışları', () => {
  const ci = read('../.github/workflows/elvankent-ci.yml');
  // Yorum satırları belgeleme içindir (yasak adları anlatır); denetim yalnız çalışan YAML'a yapılır
  const wf = read('../.github/workflows/elvankent-restore-drill.yml').split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  test('CI database işi: sentetik kuru prova (A/B/C + canlının gerçek durumu D + K6 Storage S zorunlu)', () => {
    const db = ci.split(/\n {2}database:\n/)[1]?.split(/\n {2}[a-z][\w-]*:\n/)[0] ?? '';
    const step = db.slice(db.indexOf('- name: KI-24 sentetik geri yükleme provası'));
    assert.ok(step.length > 40, 'adım var');
    assert.match(step, /DRILL_URL=postgresql:\/\/supabase_admin:postgres@127\.0\.0\.1:54322\/postgres/);
    assert.match(step, /LIVE_LIKE_SEED=\/tmp\/seed\.sql bash scripts\/live-like-stack\.sh start\n/);
    // CI ana yığından önce supabase/seed.sql'i /tmp/seed.sql'e taşır (CI #124: canlı benzeri yığın tohumu bulamadı)
    assert.match(db, /mv supabase\/seed\.sql \/tmp\/seed\.sql/);
    assert.match(step, /trap 'bash scripts\/live-like-stack\.sh stop' EXIT/);
    assert.match(step, /LIVE_DRILL_URL=postgresql:\/\/supabase_admin:postgres@127\.0\.0\.1:55322\/postgres REQUIRE_LIVE_LIKE=1/);
    assert.match(step, /REQUIRE_STORAGE=1/);
    assert.match(step, /bash scripts\/restore-drill-synthetic\.sh/);
    assert.doesNotMatch(step.split('\n      - name:')[0], /secrets\./, 'sentetik provada sır yok');
    const syn = read('scripts/restore-drill-synthetic.sh');
    assert.match(syn, /SUPABASE_DB_URL="\$DB_URL"[^\n]*bash "\$HERE\/backup-db\.sh"/);
    assert.match(syn, /ADMIN_DB_URL="\$\{4:-\$DRILL_URL\}"[^\n]*bash "\$HERE\/restore-drill\.sh"/);
    for (const want of [
      "'BUTUNLUK=TAMAM' 'SEMA=TAMAM'", "'BUTUNLUK=TAMAM' 'SEMA=BILGI'", "'BUTUNLUK=HATA'",
      "'BUTUNLUK=TAMAM' 'SEMA=BILGI' 'SEMA_SURUM=yok'", 'disable row level security', 'organizations_public_read',
      'to anon"', "'STORAGE=TAMAM' 'STORAGE_DOSYA=25' 'STORAGE_AYNI=25'",
    ]) assert.ok(syn.includes(want), want);
    assert.equal((syn.match(/'BUTUNLUK=TAMAM' 'SEMA=HATA'/g) ?? []).length, 3, 'D2–D4 HATA bekler');
  });
  test('canlı benzeri yığın: ayrı proje ve 553xx portları, kesim karay_schema_version öncesi, yalnız yerel', () => {
    const sh = read('scripts/live-like-stack.sh');
    assert.match(sh, /CUTOFF=\$\{2:-20261010000000\}/);
    assert.match(sh, /project_id = "karay-canli-benzeri"/);
    assert.match(sh, /s\/= 543\(\[0-9\]\{2\}\)\$\/= 553\\1\//);
    assert.match(sh, /grep -qE '\^port = 55322\$'/);
    assert.doesNotMatch(sh, /supabase\.co|SUPABASE_DB_URL|secrets/);
    assert.ok(LATEST > '20261010000000', 'kesimden sonra en az bir migration var: canlı benzeri şema gerçekten geride');
  });
  test('gerçek veri iş akışı K6: R2 örneği → yerel geçici Storage → SHA-256; yollar günlüğe yazılmaz', () => {
    const k6 = wf.slice(wf.indexOf('- name: Storage örneği (K6'), wf.indexOf('- name: Temizlik'));
    assert.ok(k6.length > 100, 'K6 adımı var');
    assert.match(k6, /if: \$\{\{ !cancelled\(\) \}\}/);
    assert.match(k6, /rclone lsf "src:\$BACKUP_BUCKET\/storage\/current\/\$b\/" -R --files-only[^\n]*\n[^\n]*--log-file[^\n]*> "\$RUNNER_TEMP\/k6-\$b\.all"/);
    assert.match(k6, /rclone copy "src:\$BACKUP_BUCKET\/storage\/current\/\$b\/" "\$K6\/\$b\/" --files-from/);
    assert.match(k6, /STORAGE_DRILL_URL="\$API_URL" STORAGE_DRILL_KEY="\$SERVICE_ROLE_KEY"/);
    assert.match(k6, /node scripts\/storage-roundtrip-drill\.mjs/);
    assert.match(k6, /::add-mask::\$SERVICE_ROLE_KEY/);
    assert.doesNotMatch(k6, /cat "\$RUNNER_TEMP\/k6-|head "\$RUNNER_TEMP\/k6-/, 'liste günlüğe basılmaz');
    assert.match(wf, /rm -rf [^\n]*"\$RUNNER_TEMP\/k6"/);
  });
  test('iş akışlarındaki run betikleri bash sözdizimine uygun', () => {
    for (const [name, text] of [['elvankent-restore-drill.yml', read('../.github/workflows/elvankent-restore-drill.yml')], ['elvankent-ci.yml', ci]]) {
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const m = lines[i].match(/^(\s*)(?:- )?run: \|$/);
        if (!m) continue;
        const body = [];
        let indent = null;
        for (let j = i + 1; j < lines.length; j += 1) {
          if (lines[j].trim() === '') { body.push(''); continue; }
          const ind = lines[j].match(/^\s*/)[0].length;
          if (indent === null) indent = ind;
          if (ind < indent) break;
          body.push(lines[j].slice(indent));
        }
        const r = spawnSync('bash', ['-n'], { input: body.join('\n'), encoding: 'utf8' });
        assert.equal(r.status, 0, `${name}:${i + 1} ${r.stderr}`);
      }
    }
  });
  test('sentetik prova betiği de yalnız yerel adreslerle çalışır (hiçbir araç çağrılmaz)', (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'karay-syn-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const log = path.join(dir, 'calls.log');
    writeFileSync(log, '');
    for (const tool of ['psql', 'pg_dump', 'pg_restore']) {
      writeFileSync(path.join(dir, tool), `#!/usr/bin/env bash\necho "${tool} $*" >> "${log}"\n`);
      chmodSync(path.join(dir, tool), 0o755);
    }
    for (const env of [
      { DB_URL: 'postgresql://postgres:x@db.abcdefghijklmnopqrst.supabase.co:5432/postgres', DRILL_URL: LOCAL },
      { DB_URL: LOCAL, DRILL_URL: 'postgresql://postgres@10.0.0.5:5432/postgres' },
    ]) {
      const r = spawnSync('bash', [path.join(root, 'scripts/restore-drill-synthetic.sh')], { env: { PATH: `${dir}:/usr/bin:/bin`, ...env }, encoding: 'utf8' });
      assert.equal(r.status, 2, r.stdout + r.stderr);
      assert.match(r.stderr, /YALITIM/);
      assert.equal(readFileSync(log, 'utf8'), '');
    }
  });
  test('gerçek veri iş akışı: yalnız sahibin eylemi + onay değişkeni + korumalı ortam; canlı sır yok; artifact yok; R2 yalnız okunur', () => {
    assert.match(wf, /\non:\n {2}workflow_dispatch: \{\}\n {2}push:\n {4}branches: \['claude\/karays-mission-control-vn8g65'\]\n {4}paths: \['elvankent-gayrimenkul\/ops-requests\/restore-drill\.request'\]\n/);
    assert.match(wf, /vars\.RESTORE_DRILL_REAL_DATA_APPROVED == 'true'/);
    assert.match(wf, /!contains\(github\.event\.head_commit\.message, 'Claude-Session:'\)/);
    assert.match(wf, /\n {4}environment: restore-drill\n/);
    assert.match(wf, /\npermissions:\n {2}contents: read\n/);
    assert.doesNotMatch(wf, /SUPABASE_DB_URL|SUPABASE_S3_|BACKUP_S3_ACCESS_KEY_ID|BACKUP_S3_SECRET_ACCESS_KEY/, 'canlı / yazma anahtarı yok');
    assert.match(wf, /secrets\.RESTORE_S3_ACCESS_KEY_ID/);
    assert.doesNotMatch(wf, /upload-artifact/);
    assert.doesNotMatch(wf, /rclone (sync|delete|deletefile|purge|move|moveto|copyto|rmdirs?) /);
    assert.match(wf, /rclone copy "src:\$BACKUP_BUCKET\/db\/" "\$RUNNER_TEMP\/yedek\/" --include "db-\$STAMP\.\*"/);
    assert.match(wf, /ADMIN_DB_URL="\$DB_URL"/);
    assert.doesNotMatch(wf, /--log-level DEBUG|--dump /);
  });
});
