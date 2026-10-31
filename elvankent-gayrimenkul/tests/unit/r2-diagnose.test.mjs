/**
 * R2-xx · Cloudflare R2 bağlantı teşhisi (scripts/r2-diagnose.sh, .github/workflows/elvankent-r2-diagnose.yml).
 * Betik sahte `rclone` ve `aws` ikilileriyle GERÇEKTEN çalıştırılır (ağ yok): sahte kova geçici klasördür.
 *
 *   R2-01  iş akışı: yalnız elle (dispatch / sahibin istek dosyası düzenlemesi), en az yetki, sabit SHA, veritabanı yok
 *   R2-02  betik: yalnız tek test anahtarında yazma/silme; sync/delete/purge/move yok; sır değerleri yazdırılmaz
 *   R2-03  ayar biçimi hataları aşama 0'da, değerler sızmadan (API token uzunluğu, boşluk, yol, bölge, AB uç noktası)
 *   R2-04  tam başarı: yükle → oku → sil; var olan yedek dosyasına dokunulmaz
 *   R2-05  400 / 403 / imza hataları doğru aşama ve güvenli kategoriyle; ham metin ve uç nokta yazılmaz
 *   R2-06  silme başarısızsa yalnız nesne anahtarı raporlanır
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const SCRIPT = new URL('scripts/r2-diagnose.sh', root).pathname;
const wf = read('../.github/workflows/elvankent-r2-diagnose.yml');
const script = read('scripts/r2-diagnose.sh');
const code = script.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

const ACCOUNT = 'a'.repeat(32);
const GOOD = {
  BACKUP_S3_ENDPOINT: `https://${ACCOUNT}.r2.cloudflarestorage.com`,
  BACKUP_S3_REGION: 'auto',
  BACKUP_S3_ACCESS_KEY_ID: '0123456789abcdef0123456789abcdef',
  BACKUP_S3_SECRET_ACCESS_KEY: 'f'.repeat(64),
  BACKUP_BUCKET: 'karays-yedek',
  BACKUP_S3_PROVIDER: 'Cloudflare',
};

// Sahte rclone: "diag:<kova>/<anahtar>" → $FAKE_ROOT/<kova>/<anahtar>; FAKE_FAIL=<alt komut> ise FAKE_MSG ile başarısız
const FAKE_RCLONE = `#!/usr/bin/env bash
cmd="$1"; shift
# Gerçek rclone gibi: yapılandırma dosyası yoksa her komutta stderr'e NOTICE (teşhis #3'teki yanlış "anahtar var" hatası)
echo '<5>NOTICE: Config file "/home/runner/.config/rclone/rclone.conf" not found - using defaults' >&2
if [ "$cmd" = version ]; then echo "rclone v1.60.1-DEV"; exit 0; fi
if [ "\${FAKE_FAIL:-}" = "$cmd" ]; then printf '%b\\n' "$FAKE_MSG" >&2; exit 1; fi
echo "$cmd $*" >> "$FAKE_ROOT/.calls"
loc() { local r="\${1#diag:}"; printf '%s/%s' "$FAKE_ROOT" "$r"; }
case "$cmd" in
  lsf) t=$(loc "$1"); if [ -d "$t" ]; then ls "$t"; elif [ -f "$t" ]; then basename "$t"; fi; exit 0 ;;
  copyto) t=$(loc "$2"); mkdir -p "$(dirname "$t")"; cp "$1" "$t" ;;
  cat) cat "$(loc "$1")" ;;
  deletefile) rm "$(loc "$1")" ;;
  *) echo "beklenmeyen komut $cmd" >&2; exit 9 ;;
esac
`;
const FAKE_AWS = `#!/usr/bin/env bash
if [ -n "\${FAKE_AWS_MSG:-}" ]; then printf '%b\\n' "$FAKE_AWS_MSG" >&2; exit 254; fi
echo '{"KeyCount": 0}'
`;

function run(t, env = {}, { aws = true } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'karay-r2-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  const bucketRoot = path.join(dir, 'r2');
  mkdirSync(bin);
  mkdirSync(path.join(bucketRoot, 'karays-yedek', 'db'), { recursive: true });
  // Var olan bir yedek: teşhis ona asla dokunmamalı
  writeFileSync(path.join(bucketRoot, 'karays-yedek', 'db', 'db-2026-10-31T2152Z.dump'), 'YEDEK');
  writeFileSync(path.join(bin, 'rclone'), FAKE_RCLONE);
  chmodSync(path.join(bin, 'rclone'), 0o755);
  if (aws) {
    writeFileSync(path.join(bin, 'aws'), FAKE_AWS);
    chmodSync(path.join(bin, 'aws'), 0o755);
  }
  const summary = path.join(dir, 'summary.md');
  const r = spawnSync('bash', ['--noprofile', '--norc', SCRIPT], {
    env: { PATH: `${bin}:/usr/bin:/bin`, FAKE_ROOT: bucketRoot, GITHUB_STEP_SUMMARY: summary, RUN_TAG: '123-1', ...GOOD, ...env },
    encoding: 'utf8',
  });
  const out = r.stdout + r.stderr + (existsSync(summary) ? readFileSync(summary, 'utf8') : '');
  const diagDir = path.join(bucketRoot, 'karays-yedek', 'diagnostics');
  return {
    status: r.status,
    out,
    left: existsSync(diagDir) ? readdirSync(diagDir) : [],
    backupIntact: readFileSync(path.join(bucketRoot, 'karays-yedek', 'db', 'db-2026-10-31T2152Z.dump'), 'utf8') === 'YEDEK',
  };
}
const noLeak = (out) => {
  for (const v of [GOOD.BACKUP_S3_ACCESS_KEY_ID, GOOD.BACKUP_S3_SECRET_ACCESS_KEY, ACCOUNT, GOOD.BACKUP_S3_ENDPOINT, 's3.example.com', 'x'.repeat(40)]) {
    assert.ok(!out.includes(v), `çıktıda gizli/kimlik değeri var: ${v.slice(0, 6)}…`);
  }
};

describe('R2-01 iş akışı', () => {
  test('yalnız workflow_dispatch ve çalışma dalındaki istek dosyası; iş koşulu geliştirme commit\'lerini dışlar', () => {
    assert.match(wf, /\non:\n {2}workflow_dispatch: \{\}\n {2}push:\n {4}branches: \['claude\/karays-mission-control-vn8g65'\]\n {4}paths: \['elvankent-gayrimenkul\/ops-requests\/r2-diagnose\.request'\]\n/);
    assert.doesNotMatch(wf, /\n {2}(schedule|pull_request|workflow_run|repository_dispatch):/);
    assert.match(wf, /if: \$\{\{ github\.event_name == 'workflow_dispatch' \|\| !contains\(github\.event\.head_commit\.message, 'Claude-Session:'\) \}\}/);
    assert.ok(existsSync(new URL('ops-requests/r2-diagnose.request', root)), 'istek dosyası var');
    assert.doesNotMatch(read('ops-requests/r2-diagnose.request'), /https?:\/\/|[0-9a-f]{32}/, 'istek dosyasında adres/anahtar yok');
  });
  test('en az yetki, sabit çalıştırıcı ve SHA, veritabanı sırrı yok', () => {
    assert.match(wf, /\npermissions:\n {2}contents: read\n/);
    assert.match(wf, /runs-on: ubuntu-24\.04/);
    for (const m of wf.matchAll(/uses:\s*(\S+)(.*)/g)) {
      assert.match(m[1], /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      assert.match(m[2].trim(), /^# v\d+\.\d+\.\d+$/);
    }
    assert.doesNotMatch(wf, /SUPABASE_DB_URL/);
    // Supabase S3 anahtarları yalnız storage-probe işinde (Backup #43 kaynak tarafı, salt okuma)
    const r2Job = wf.slice(wf.indexOf('\n  r2:'), wf.indexOf('\n  storage-probe:'));
    assert.doesNotMatch(r2Job, /SUPABASE_S3/);
    assert.match(wf, /bash elvankent-gayrimenkul\/scripts\/r2-diagnose\.sh/);
    assert.doesNotMatch(wf, /echo[^\n]*secrets\./);
  });
  test('yedek iş akışı bu teslimde değişmedi (teşhis tamamlanmadan)', () => {
    assert.match(read('../.github/workflows/elvankent-backup.yml'), /rclone copyto "db-\$STAMP\.dump" "dest:\$BUCKET\/db\/db-\$STAMP\.dump" --s3-no-check-bucket/);
  });
});

describe('R2-02 betik güvenliği', () => {
  test('yazma/silme yalnız tek test anahtarında; toplu komut yok', () => {
    assert.doesNotMatch(code, /rclone (sync|delete|purge|move|moveto|rmdirs?|cleanup|copy) /);
    for (const m of code.matchAll(/rclone (copyto|deletefile) [^\n]*/g)) assert.match(m[0], /"diag:\$BACKUP_BUCKET\/\$KEY"/, m[0]);
    assert.match(code, /KEY="diagnostics\/r2-test-\$\{RUN_TAG\}-/);
  });
  test('sır değerleri ve ham çıktı yazdırılmaz', () => {
    assert.doesNotMatch(code, /(say|echo|printf)[^\n]*\$\{?(BACKUP_S3_ENDPOINT|BACKUP_S3_ACCESS_KEY_ID|BACKUP_S3_SECRET_ACCESS_KEY|ak|sk|ep|host)\b(?!:-)/);
    assert.doesNotMatch(code, /cat "\$WORK\/(list|aws|put|get|del|cleanup)\.out"/);
  });
});

describe('R2-03 ayar biçimi (aşama 0)', () => {
  const cases = [
    ['Cloudflare API token (40 karakter) erişim anahtarı yerine', { BACKUP_S3_ACCESS_KEY_ID: 'x'.repeat(40) }, /BACKUP_S3_ACCESS_KEY_ID R2 biçiminde değil \(40 karakter/],
    ['gizli anahtarın sonunda satır sonu', { BACKUP_S3_SECRET_ACCESS_KEY: `${'f'.repeat(64)}\n` }, /BACKUP_S3_SECRET_ACCESS_KEY boşluk ya da satır sonu/],
    ['uç noktanın sonunda kova yolu', { BACKUP_S3_ENDPOINT: `https://${ACCOUNT}.r2.cloudflarestorage.com/karays-yedek` }, /sonunda yol var/],
    ['bölge auto değil', { BACKUP_S3_REGION: 'eu-central-1' }, /BACKUP_S3_REGION R2 için geçerli değil/],
    ['R2 olmayan uç nokta', { BACKUP_S3_ENDPOINT: 'https://s3.example.com' }, /biçimi R2 değil/],
    ['sağlayıcı Other', { BACKUP_S3_PROVIDER: 'Other' }, /BACKUP_S3_PROVIDER 'Other'/],
    ['eksik sır', { BACKUP_S3_REGION: '' }, /BACKUP_S3_REGION tanımlı değil/],
  ];
  for (const [name, env, re] of cases) {
    test(name, (t) => {
      const r = run(t, env);
      assert.equal(r.status, 1);
      assert.match(r.out, /AŞAMA 0 ayarlar: HATA/);
      assert.match(r.out, re);
      assert.match(r.out, /SONUÇ: 0 ayarlar aşamasında durdu/);
      noLeak(r.out);
      assert.deepEqual(r.left, []);
    });
  }
  test('AB yargı bölgesi uç noktası kabul edilir ve raporlanır', (t) => {
    const r = run(t, { BACKUP_S3_ENDPOINT: `https://${ACCOUNT}.eu.r2.cloudflarestorage.com` });
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /yargı bölgesi: AB \(eu\)/);
  });
});

describe('R2-04 tam başarı', () => {
  test('yükle → oku (SHA-256) → yalnız test dosyasını sil; yedek dosyası aynen durur', (t) => {
    const r = run(t);
    assert.equal(r.status, 0, r.out);
    for (const s of ['0 ayarlar', '1 erişim', '2 yükleme', '3 okuma', '4 silme']) assert.match(r.out, new RegExp(`AŞAMA ${s}: TAMAM`));
    assert.match(r.out, /test dosyası yüklendi: diagnostics\/r2-test-123-1-[0-9a-f]{12}\.txt/);
    assert.match(r.out, /SONUÇ: TAMAM/);
    assert.deepEqual(r.left, [], 'test dosyası kalmadı');
    assert.ok(r.backupIntact, 'mevcut yedek değişmedi');
    noLeak(r.out);
  });
});

describe('R2-05 hata kategorileri', () => {
  test('Backup #41 benzeri: yüklemede 400 Bad Request → aşama 2, istek_gecersiz; temizlik denenir', (t) => {
    const r = run(t, { FAKE_FAIL: 'copyto', FAKE_MSG: `Failed to copyto: BadRequest: Bad Request\\n\\tstatus code: 400, request id: , host id: ${GOOD.BACKUP_S3_ENDPOINT}` });
    assert.equal(r.status, 1);
    assert.match(r.out, /AŞAMA 2 yükleme: HATA — rclone v1\.60\.1: istek_gecersiz/);
    noLeak(r.out);
    assert.ok(r.backupIntact);
  });
  test('erişimde 403 → aşama 1, yetki_reddedildi; aws cli ikinci görüşü imza hatası der', (t) => {
    const r = run(t, {
      FAKE_FAIL: 'lsf',
      FAKE_MSG: 'AccessDenied: Access Denied\\n\\tstatus code: 403',
      FAKE_AWS_MSG: 'An error occurred (SignatureDoesNotMatch) when calling the ListObjectsV2 operation: The request signature we calculated does not match',
    });
    assert.equal(r.status, 1);
    assert.match(r.out, /AŞAMA 1 erişim: HATA — rclone v1\.60\.1: yetki_reddedildi .* aws cli: imza_uyusmuyor/);
    assert.deepEqual(r.left, []);
  });
  test('R2\'nin "access key has length 40" iletisi kategoriye çevrilir', (t) => {
    const r = run(t, { FAKE_FAIL: 'lsf', FAKE_MSG: 'InvalidArgument: Credential access key has length 40, should be 32\\n\\tstatus code: 400' });
    assert.match(r.out, /erisim_anahtari_uzunlugu \(40 karakter, beklenen 32/);
  });
  test('kova yok / DNS hatası kategorileri; aws cli yoksa not düşülür', (t) => {
    const a = run(t, { FAKE_FAIL: 'lsf', FAKE_MSG: 'NoSuchBucket: The specified bucket does not exist\\n\\tstatus code: 404' }, { aws: false });
    assert.match(a.out, /kova_bulunamadi .* aws cli yok/);
    const b = run(t, { FAKE_FAIL: 'lsf', FAKE_MSG: `dial tcp: lookup ${ACCOUNT}.r2.cloudflarestorage.com: no such host` });
    assert.match(b.out, /ag_baglanti/);
    noLeak(b.out);
  });
});

describe('R2-06 kalan test dosyası', () => {
  test('silme başarısızsa yalnız nesne anahtarı raporlanır; yedek dosyasına dokunulmaz', (t) => {
    const r = run(t, { FAKE_FAIL: 'deletefile', FAKE_MSG: 'AccessDenied\\n\\tstatus code: 403' });
    assert.equal(r.status, 1);
    assert.match(r.out, /AŞAMA 4 silme: HATA — rclone v1\.60\.1: yetki_reddedildi/);
    assert.match(r.out, /Nesne anahtarı: diagnostics\/r2-test-123-1-[0-9a-f]{12}\.txt/);
    assert.equal(r.left.length, 1);
    assert.ok(r.backupIntact);
    noLeak(r.out);
  });
});

describe('R2-07 Storage aktarım sondası (Backup #43)', () => {
  const probe = read('scripts/storage-transfer-probe.sh');
  const pcode = probe.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  test('iş: R2 teşhisinden sonra, aynı elle tetikleme koşulu; güncel rclone imza + SHA-256 ile doğrulanır', () => {
    const job = wf.slice(wf.indexOf('\n  storage-probe:'));
    assert.match(job, /needs: r2/);
    assert.match(job, /if: \$\{\{ github\.event_name == 'workflow_dispatch' \|\| !contains\(github\.event\.head_commit\.message, 'Claude-Session:'\) \}\}/);
    assert.match(job, /RCLONE_NEW: v\d+\.\d+\.\d+/);
    assert.match(job, /RCLONE_KEY_FPR: [0-9A-F]{40}/);
    assert.match(job, /gpg --batch --status-fd 1 --verify SHA256SUMS[^\n]*\| grep -q "VALIDSIG \.\*\$RCLONE_KEY_FPR"/);
    assert.match(job, /grep " \$zip\\\$" SHA256SUMS \| sha256sum -c --quiet -/);
    assert.doesNotMatch(job, /SUPABASE_DB_URL/);
  });
  test('kaynak yalnız okunur; hedefte yalnız sonda önekine yazılır/silinir; toplu komut yok', () => {
    assert.doesNotMatch(pcode, /"(supa):[^"]*"[^\n]*(copyto|deletefile|sync|delete|purge|move)|(copyto|deletefile|sync|delete|purge|move) "supa:/);
    assert.doesNotMatch(pcode, /rclone[^\n]* (sync|delete|purge|move|moveto|rmdirs?|cleanup) /);
    for (const m of pcode.matchAll(/(copyto|deletefile) [^\n]*/g)) {
      if (m[0].includes('"R2')) assert.match(m[0], /\$BACKUP_BUCKET\/(\$PREFIX\/|\$dst|\$d")/, m[0]);
    }
    assert.match(pcode, /PREFIX="diagnostics\/\$TAG"/);
    assert.match(pcode, /dst="\$PREFIX\/dst\//);
  });
  test('günlüğe yalnız özet: ham döküm, yol ve uç nokta basılmaz', () => {
    assert.doesNotMatch(pcode, /cat "\$WORK\/(a-|b-|src)/);
    assert.doesNotMatch(pcode, /(say|md|echo|printf)[^\n]*\$(obj|SUPA_HOST|R2_HOST|SUPABASE_S3_ENDPOINT|BACKUP_S3_ENDPOINT)\b/);
    assert.match(pcode, /--dump headers --log-level DEBUG --log-file/);
  });
  test('döküm özetleyici: taraf/yöntem/durum sayar, 501 başlık ADLARINI verir; yol ve adres yazmaz', (t) => {
    const fn = probe.slice(probe.indexOf('summarize_dump() {'), probe.indexOf('\ncleanup() {'));
    const dump = [
      '2026/10/31 DEBUG : HTTP REQUEST (req 0xc0001)',
      '2026/10/31 DEBUG : HEAD /karays-yedek/storage/current/media-originals/organizations/x/original HTTP/1.1',
      'Host: acct.r2.example',
      'Authorization: XXXX',
      'X-Amz-Date: 20261031T000000Z',
      '2026/10/31 DEBUG : HTTP RESPONSE (req 0xc0001)',
      '2026/10/31 DEBUG : HTTP/1.1 501 Not Implemented',
      '2026/10/31 DEBUG : HTTP REQUEST (req 0xc0002)',
      '2026/10/31 DEBUG : GET /media-originals/organizations/x/original HTTP/1.1',
      'Host: proj.supabase.example',
      '2026/10/31 DEBUG : HTTP RESPONSE (req 0xc0002)',
      '2026/10/31 DEBUG : HTTP/1.1 200 OK',
      '',
    ].join('\n');
    const dir = mkdtempSync(path.join(tmpdir(), 'karay-dump-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    writeFileSync(path.join(dir, 'd.log'), dump);
    const r = spawnSync('bash', ['--noprofile', '--norc', '-c', `${fn}\nsummarize_dump "$1"`, 'x', path.join(dir, 'd.log')], {
      env: { PATH: '/usr/bin:/bin', SUPA_HOST: 'proj.supabase.example', R2_HOST: 'acct.r2.example' },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /^r2 HEAD 501 ×1$/m);
    assert.match(r.stdout, /^supabase GET 200 ×1$/m);
    assert.match(r.stdout, /501 başlık adları \(r2 HEAD\): authorization x-amz-date/);
    for (const leak of ['organizations', 'karays-yedek', 'acct.r2.example', 'proj.supabase.example', 'XXXX']) assert.ok(!r.stdout.includes(leak), leak);
  });
});
