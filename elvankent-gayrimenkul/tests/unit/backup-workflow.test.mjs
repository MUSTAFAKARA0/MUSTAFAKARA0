/**
 * Yedek iş akışı (.github/workflows/elvankent-backup.yml) ve bağımlı betikler — varsayılan daldaki gece yedeği için.
 * Çalışma dalındaki tests/unit/security-backup.test.mjs'nin yedek iş akışı bölümleri (BK-02, BK-02b/c/d); Backup #39–#45.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');

describe('BK-02 yedek iş akışı', () => {
  const wf = read('../.github/workflows/elvankent-backup.yml');
  test('betiği çalıştırır; dört dosya yüklenir ve depodakiyle karşılaştırılır', () => {
    assert.match(wf, /bash elvankent-gayrimenkul\/scripts\/backup-db\.sh/);
    for (const ext of ['dump', 'fingerprint.txt', 'tables.txt', 'sha256']) {
      assert.ok(wf.includes(`rclone copyto "db-$STAMP.${ext}" "dest:$BUCKET/db/db-$STAMP.${ext}"`), ext);
    }
    assert.match(wf, /rclone check \. "dest:\$BUCKET\/db" --one-way --include "db-\$STAMP\.\*"/);
    assert.match(wf, /elvankent-gayrimenkul\/scripts\n/, 'sparse checkout betik klasörünü içerir');
  });
  test('yedek kapalıyken görünür uyarı (sessiz atlama yok)', () => {
    assert.match(wf, /backup-disabled:\n\s+if: \$\{\{ vars\.ELVANKENT_BACKUP_ENABLED != 'true' \}\}/);
    assert.match(wf, /::warning title=Yedek alınmadı::/);
    assert.match(wf, /backup:\n\s+if: \$\{\{ vars\.ELVANKENT_BACKUP_ENABLED == 'true' \}\}/);
  });
  test('eksik ayar denetimi yalnızca ADLARI yazar', () => {
    assert.match(wf, /\[ -n "\$\{!name:-\}" \] \|\| missing\+=\("\$\{pair#\*:\}"\)/);
    assert.match(wf, /Tanımlı olmayan değişken\/sır: \$\{missing\[\*\]\}/);
    assert.doesNotMatch(wf, /echo[^\n]*\$\{!name/);
  });
  test('log: kayıt sayısı / boyut yazılmaz; en az yetki', () => {
    assert.doesNotMatch(wf, /cut -d'\|'|ls -lh|cat "db-/);
    assert.match(wf, /permissions:\n\s+contents: read/);
  });
});


describe('BK-02b PostgreSQL 17 istemcisi (Backup #39: pg_dump 16.15 ↔ sunucu 17.6)', () => {
  const wf = read('../.github/workflows/elvankent-backup.yml');
  const stepRun = (name) => {
    const start = wf.indexOf(`- name: ${name}`);
    assert.ok(start > 0, `${name} adımı var`);
    const block = wf.slice(start).match(/\n( +)run: \|\n([\s\S]*?)(?=\n {6}- |\n*$)/);
    const indent = block[2].match(/^ */)[0].length;
    return block[2].split('\n').map((l) => l.slice(indent)).join('\n');
  };
  test('PG 17 ikilileri kurulumdan sonra sonraki adımların PATH\'ine eklenir; sabitler iş düzeyinde', () => {
    assert.match(wf, /\n {6}PG_MAJOR: '17'\n {6}PG_BIN: \/usr\/lib\/postgresql\/17\/bin\n/);
    const install = stepRun('Araçları kur (pg_dump 17, rclone sabit sürüm)');
    assert.ok(install.indexOf('postgresql-client-17') < install.indexOf('echo "$PG_BIN" >> "$GITHUB_PATH"'), 'kurulumdan sonra PATH');
    assert.match(install, /for tool in psql pg_dump pg_restore; do\n\s+\[ -x "\$PG_BIN\/\$tool" \]/);
  });
  test('sürüm denetimi yedekten önce; sunucu sürümü backup-db.sh\'den önce denetlenir', () => {
    const order = ['Araçları kur (pg_dump 17, rclone sabit sürüm)', 'PostgreSQL istemci sürümü (yedekten önce)', 'Veritabanı yedeği'].map((n) => wf.indexOf(`- name: ${n}`));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    const backup = stepRun('Veritabanı yedeği');
    assert.ok(backup.indexOf("show server_version_num") < backup.indexOf('bash elvankent-gayrimenkul/scripts/backup-db.sh'));
    assert.match(backup, /\$\(\(server_num \/ 10000\)\) -gt "\$PG_MAJOR"/);
  });
  // Denetim adımı sahte ikililerle GERÇEKTEN çalıştırılır (YAML metni değil, davranış)
  const runCheck = (t, { pgVersions, wrapperFirst = false }) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'karay-pg-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const pgBin = path.join(dir, 'pg17');
    const wrapper = path.join(dir, 'usrbin');
    for (const d of [pgBin, wrapper]) mkdirSync(d);
    for (const tool of ['psql', 'pg_dump', 'pg_restore']) {
      const v = pgVersions[tool] ?? '17.6';
      writeFileSync(path.join(pgBin, tool), `#!/bin/sh\necho "${tool} (PostgreSQL) ${v} (Ubuntu ${v}-1.pgdg24.04+1)"\n`, { mode: 0o755 });
      writeFileSync(path.join(wrapper, tool), `#!/bin/sh\necho "${tool} (PostgreSQL) 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)"\n`, { mode: 0o755 });
    }
    const PATH = [wrapperFirst ? wrapper : pgBin, wrapperFirst ? pgBin : wrapper, '/usr/bin', '/bin'].join(':');
    return spawnSync('bash', ['--noprofile', '--norc', '-c', stepRun('PostgreSQL istemci sürümü (yedekten önce)')], {
      env: { PATH, PG_BIN: pgBin, PG_MAJOR: '17' },
      encoding: 'utf8',
    });
  };
  test('üç araç da PG_BIN\'den ve 17: geçer, sürümleri yazar', (t) => {
    const r = runCheck(t, { pgVersions: {} });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /pg_dump: pg_dump \(PostgreSQL\) 17\.6/);
  });
  test('/usr/bin sarmalayıcısı (16.15) önce gelirse: yedek başlatılmaz', (t) => {
    const r = runCheck(t, { pgVersions: {}, wrapperFirst: true });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error title=PostgreSQL istemci sürümü yanlış::psql: .*sürüm 16 .*yedek başlatılmadı/);
  });
  test('PG_BIN\'deki pg_restore yanlış ana sürümse: yedek başlatılmaz', (t) => {
    const r = runCheck(t, { pgVersions: { pg_restore: '16.15' } });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /pg_restore: .*sürüm 16 /);
  });
});


describe('BK-02d rclone sabit sürüm (Backup #43: 1.60.1 → R2 HEAD 501; Backup #44: RCLONE_VERSION çakışması)', () => {
  const wf = read('../.github/workflows/elvankent-backup.yml');
  const install = wf.slice(wf.indexOf('- name: Araçları kur (pg_dump 17, rclone sabit sürüm)'), wf.indexOf('- name: PostgreSQL istemci sürümü'));
  const backupJob = wf.slice(wf.indexOf('\n  backup:\n'));
  // İş düzeyindeki sabit (sır/değişken olmayan) ortam değerleri: "      AD: değer"
  const jobEnv = Object.fromEntries(
    [...backupJob.slice(backupJob.indexOf('\n    env:\n'), backupJob.indexOf('\n    steps:\n')).matchAll(/^ {6}([A-Z0-9_]+): (.+)$/gm)]
      .filter((m) => !m[2].includes('${{'))
      .map((m) => [m[1], m[2].replace(/^'(.*)'$/, '$1')]),
  );
  test('Ubuntu paketi kurulmaz; sürüm ve özet iş düzeyinde sabit, değerler değişmedi; teşhisle doğrulanan sürümle aynı', () => {
    assert.doesNotMatch(install, /apt-get install[^\n]*\brclone\b/);
    assert.equal(jobEnv.BACKUP_RCLONE_VERSION, 'v1.75.2');
    assert.equal(jobEnv.BACKUP_RCLONE_SHA256, '349ac8fba6ff65d6247043f1750cdcb518ec5d500ef91463a10d37c0ccdf3702');
  });
  test('resmî sürümden indirilir, SHA-256 denetlenir, /usr/local/bin\'e kurulur, sürüm komutu başarısız ya da farklıysa yedek başlamaz', () => {
    assert.match(install, /https:\/\/github\.com\/rclone\/rclone\/releases\/download\/\$BACKUP_RCLONE_VERSION\/\$zip/);
    assert.match(install, /echo "\$BACKUP_RCLONE_SHA256 {2}\$zip" \| sha256sum -c --quiet -/);
    assert.match(install, /sudo install -m 0755 "rclone-\$BACKUP_RCLONE_VERSION-linux-amd64\/rclone" \/usr\/local\/bin\/rclone/);
    assert.match(install, /if ! out=\$\(rclone version 2>&1\); then/);
    assert.match(install, /\[ "\$got" = "rclone \$BACKUP_RCLONE_VERSION" \]/);
    assert.ok(install.indexOf('sha256sum -c') < install.indexOf('sudo install -m 0755'), 'özet kurulumdan önce');
  });
  test('regresyon (Backup #44): iş akışında RCLONE_CONFIG_* dışında RCLONE_ önekli ortam değişkeni yok', () => {
    // rclone, RCLONE_<SEÇENEK> değişkenlerini kendi seçenekleri sayar (RCLONE_VERSION → --version); iş/adım env'i taranır
    const offenders = [...wf.matchAll(/^\s+(RCLONE_[A-Z0-9_]+):/gm)].map((m) => m[1]).filter((n) => !n.startsWith('RCLONE_CONFIG_'));
    assert.deepEqual(offenders, []);
    assert.doesNotMatch(wf, /\$\{?RCLONE_(VERSION|SHA256)\b/, 'eski adlara kabukta başvuru kalmadı');
  });
  // Gerçek rclone gibi davranan sahte ikili: RCLONE_<seçenek> ortam değişkeni seçenek değerine çevrilir; --version
  // boolean olduğundan "v1.75.2" geçersizdir ve HER komut çıkış 1 verir (Backup #44'teki hata metniyle aynı).
  const FAKE = `#!/usr/bin/env bash
if [ -n "\${RCLONE_VERSION+x}" ]; then
  case "$RCLONE_VERSION" in true|false|1|0|"") ;; *)
    echo "Invalid value when setting --version from environment variable RCLONE_VERSION=\\"$RCLONE_VERSION\\": invalid argument \\"$RCLONE_VERSION\\" for \\"--version\\" flag: strconv.ParseBool: parsing \\"$RCLONE_VERSION\\": invalid syntax" >&2
    exit 1 ;; esac
fi
if [ "$1" = version ]; then printf 'rclone v1.75.2\\n- os/version: ubuntu 24.04\\n'; exit 0; fi
exit 0
`;
  const gate = (() => {
    const from = install.indexOf('if ! out=$(rclone version 2>&1); then');
    const to = install.indexOf('echo "$got (SHA-256 doğrulandı)"');
    const lines = install.slice(from, to + 'echo "$got (SHA-256 doğrulandı)"'.length).split('\n');
    const indent = lines[1].match(/^ */)[0].length - 2;
    return lines.map((l, i) => (i === 0 ? l : l.slice(indent))).join('\n');
  })();
  const runGate = (t, extraEnv = {}) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'karay-rclone-env-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(path.join(dir, 'rclone'), FAKE, { mode: 0o755 });
    return spawnSync('bash', ['--noprofile', '--norc', '-e', '-c', gate], {
      env: { PATH: `${dir}:/usr/bin:/bin`, ...jobEnv, ...extraEnv },
      encoding: 'utf8',
    });
  };
  test('sürüm denetimi iş akışının GERÇEK iş ortamıyla çalışır: rclone version başarılı ve v1.75.2', (t) => {
    const r = runGate(t);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /^rclone v1\.75\.2 \(SHA-256 doğrulandı\)$/m);
  });
  test('regresyon (Backup #44): RCLONE_VERSION ortamda olsaydı denetim yedekten önce durdururdu', (t) => {
    const r = runGate(t, { RCLONE_VERSION: jobEnv.BACKUP_RCLONE_VERSION });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /::error title=rclone çalışmıyor::'rclone version' başarısız: Invalid value when setting --version from environment variable RCLONE_VERSION/);
  });
  test('yükleme sonrası doğrulama (HEAD) korunur: --s3-no-head kullanılmaz', () => {
    assert.doesNotMatch(wf, /--s3-no-head/);
  });
});


describe('BK-02c herkese açık günlükte müşteri yolu yok (Backup #43)', () => {
  const wf = read('../.github/workflows/elvankent-backup.yml');
  const storage = wf.slice(wf.indexOf('- name: Fotoğraf ve marka dosyaları (Storage)'), wf.indexOf('- name: Saklama süresi'));
  test('Storage adımı rclone çıktısını dosyaya yazar, yalnız maskelenmiş özet basar, günlüğü siler', () => {
    assert.match(storage, /--log-file "\$log" --log-level NOTICE \|\| rc=\$\?/);
    assert.match(storage, /bash elvankent-gayrimenkul\/scripts\/rclone-log-summary\.sh "\$log" "\$b"/);
    assert.match(storage, /rm -f "\$log"/);
    assert.doesNotMatch(storage, /cat "\$log"|tail [^\n]*\$log|--stats-one-line/);
    assert.match(storage, /exit "\$rc"/, 'hata yine işi kırmızı yapar');
    assert.match(storage, /--backup-dir "dest:\$BUCKET\/storage\/deleted\/\$STAMP\/\$b"/, 'silinen dosyalar korunur');
  });
  const summarize = (t, text) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'karay-rlog-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const f = path.join(dir, 'r.log');
    writeFileSync(f, text);
    return spawnSync('bash', ['scripts/rclone-log-summary.sh', f, 'media-originals'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8' });
  };
  const ORG = '8eb88b55-ce41-43ac-ad21-cba9bf4dd469'.replace(/[0-9a-f]/g, (c) => ((parseInt(c, 16) + 3) % 16).toString(16));
  const MED = 'abcdef01-2345-4678-9abc-def012345678';
  test('özet: hata türleri ve HTTP kodları sayılır; yol, kurum/medya kimliği, kova yolu ve adres yazılmaz', (t) => {
    const r = summarize(t, [
      `2026/10/31 22:59:51 ERROR : organizations/${ORG}/properties/${MED}/images/${MED}/original: Failed to copy: NotImplemented: Not Implemented`,
      '\tstatus code: 501, request id: , host id: ',
      `2026/10/31 22:59:52 ERROR : organizations/${ORG}/content/${MED}/original: Failed to copy: NotImplemented: Not Implemented`,
      '\tstatus code: 501, request id: , host id: ',
      '2026/10/31 23:00:21 ERROR : S3 bucket karays-yedek path storage/current/media-originals: not deleting files as there were IO errors',
      `2026/10/31 23:00:21 ERROR : Attempt 1/3 failed with 43 errors and: Get "https://${'a'.repeat(32)}.r2.cloudflarestorage.com/x": dial tcp`,
      '',
    ].join('\n'));
    assert.equal(r.status, 0);
    assert.match(r.stdout, /media-originals: 4 hata satırı/);
    assert.match(r.stdout, /×2 {2}Failed to copy · NotImplemented/);
    assert.match(r.stdout, /HTTP 501 ×2/);
    for (const leak of [ORG, MED, 'organizations/', 'karays-yedek', 'storage/current', 'r2.cloudflarestorage.com', 'a'.repeat(32)]) {
      assert.ok(!r.stdout.includes(leak), `sızıntı: ${leak.slice(0, 12)}`);
    }
  });
  test('hatasız günlük ve olmayan günlük', (t) => {
    assert.match(summarize(t, '2026/10/31 NOTICE: Config file not found\n').stdout, /media-originals: hata yok/);
    const r = spawnSync('bash', ['scripts/rclone-log-summary.sh', '/yok/r.log', 'media'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8' });
    assert.match(r.stdout, /media: rclone günlüğü yok/);
  });
});

