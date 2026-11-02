// KI-41: hassas sırların (canlı veritabanı, Supabase Storage S3, R2 yedek anahtarları) hangi iş akışında, hangi onay
// ortamıyla kullanıldığının envanteri. Yeni bir iş akışı bu sırları kullanırsa ya da bir iş ortamını bırakırsa test kırmızı olur.
// Kötü niyetli değişikliği ENGELLEMEZ (push eden testi de değiştirebilir); asıl sınır GitHub ortam sırları ve onaylarıdır
// (docs/KI41_GUVENLIK_PLANI.md). Amaç dürüst hataların sessizce geçmesini önlemek ve plan ilerledikçe durumu sabitlemek.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = new URL('../../../', import.meta.url).pathname;
const dir = path.join(root, '.github/workflows');
const HASSAS = /^(SUPABASE_DB_URL|SUPABASE_S3_[A-Z_]+|BACKUP_S3_[A-Z_]+|RESTORE_S3_[A-Z_]+)$/;
const code = (t) => t.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');

/** iş akışı → { işler: { ad: { ortam, sırlar[] } }, olaylar[] } (YAML'ı girintiyle okur; bu depodaki biçim için yeterli) */
function envanter(file) {
  const src = code(readFileSync(path.join(dir, file), 'utf8'));
  const on = src.slice(src.indexOf('\non:\n') + 5, src.search(/\n(permissions|concurrency|jobs|env):/));
  const olaylar = [...on.matchAll(/^ {2}([a-z_]+):/gm)].map((m) => m[1]);
  const jobs = src.slice(src.indexOf('\njobs:\n') + 7);
  const isler = {};
  for (const parca of jobs.split(/\n(?= {2}[a-z0-9_-]+:\n)/)) {
    const ad = parca.match(/^ {2}([a-z0-9_-]+):/)?.[1];
    if (!ad) continue;
    const sirlar = [...new Set([...parca.matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]).filter((s) => HASSAS.test(s)))].sort();
    isler[ad] = { ortam: parca.match(/^ {4}environment: ([a-z0-9-]+)$/m)?.[1] ?? null, sirlar };
  }
  const ust = src.slice(0, src.indexOf('\njobs:\n'));
  assert.doesNotMatch(ust, /secrets\./, `${file}: sır iş düzeyinin dışında (tüm işlere) verilmemeli`);
  return { olaylar, isler };
}

// Bugünkü durum (02.11, K-63). "ortam: null" = KI-41 kapsamında henüz onay ortamına taşınmadı.
const BEKLENEN = {
  'elvankent-backup.yml': { backup: { ortam: null, sirlar: ['BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_ENDPOINT', 'BACKUP_S3_REGION', 'BACKUP_S3_SECRET_ACCESS_KEY', 'SUPABASE_DB_URL', 'SUPABASE_S3_ACCESS_KEY_ID', 'SUPABASE_S3_ENDPOINT', 'SUPABASE_S3_REGION', 'SUPABASE_S3_SECRET_ACCESS_KEY'] } },
  'elvankent-r2-diagnose.yml': {
    r2: { ortam: null, sirlar: ['BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_ENDPOINT', 'BACKUP_S3_REGION', 'BACKUP_S3_SECRET_ACCESS_KEY'] },
    'storage-probe': { ortam: null, sirlar: ['BACKUP_S3_ACCESS_KEY_ID', 'BACKUP_S3_ENDPOINT', 'BACKUP_S3_REGION', 'BACKUP_S3_SECRET_ACCESS_KEY', 'SUPABASE_S3_ACCESS_KEY_ID', 'SUPABASE_S3_ENDPOINT', 'SUPABASE_S3_REGION', 'SUPABASE_S3_SECRET_ACCESS_KEY'] },
  },
  'elvankent-restore-drill.yml': { 'restore-drill': { ortam: 'restore-drill', sirlar: ['BACKUP_S3_ENDPOINT', 'BACKUP_S3_REGION', 'RESTORE_S3_ACCESS_KEY_ID', 'RESTORE_S3_SECRET_ACCESS_KEY'] } },
  'elvankent-ki23-canli-denetim.yml': { denetim: { ortam: 'ki23-canli-denetim', sirlar: ['SUPABASE_DB_URL'] } },
  'elvankent-o5a-uygula.yml': { uygula: { ortam: 'o5a-uygula', sirlar: ['SUPABASE_DB_URL'] } },
  'elvankent-o5b-uygula.yml': { uygula: { ortam: 'o5a-uygula', sirlar: ['SUPABASE_DB_URL'] } },
  'elvankent-o5c-uygula.yml': { uygula: { ortam: 'o5a-uygula', sirlar: ['SUPABASE_DB_URL'] } },
};

describe('KI-41 hassas sır envanteri (.github/workflows)', () => {
  const dosyalar = readdirSync(dir).filter((f) => f.endsWith('.yml')).sort();
  const hepsi = Object.fromEntries(dosyalar.map((f) => [f, envanter(f)]));
  test('hassas sır kullanan işler yalnız bilinen iş akışlarında ve beklenen ortamla', () => {
    const gercek = {};
    for (const [f, { isler }] of Object.entries(hepsi)) {
      for (const [ad, is] of Object.entries(isler)) if (is.sirlar.length) (gercek[f] ??= {})[ad] = is;
    }
    assert.deepEqual(gercek, BEKLENEN);
  });
  test('pull_request / pull_request_target / workflow_run ile çalışan iş akışı hassas sır kullanmaz', () => {
    for (const [f, { olaylar, isler }] of Object.entries(hepsi)) {
      if (!olaylar.some((o) => /^(pull_request|pull_request_target|workflow_run)$/.test(o))) continue;
      for (const [ad, is] of Object.entries(isler)) assert.deepEqual(is.sirlar, [], `${f}/${ad}`);
    }
  });
  test('canlıya YAZAN iş akışları (O-5) onay ortamında ve canlı veritabanı adresi yalnız orada', () => {
    for (const f of ['elvankent-o5a-uygula.yml', 'elvankent-o5b-uygula.yml', 'elvankent-o5c-uygula.yml']) {
      assert.equal(hepsi[f].isler.uygula.ortam, 'o5a-uygula', f);
    }
    const ortamsizDb = Object.entries(hepsi).flatMap(([f, { isler }]) =>
      Object.entries(isler).filter(([, is]) => is.sirlar.includes('SUPABASE_DB_URL') && !is.ortam).map(([ad]) => `${f}/${ad}`));
    assert.deepEqual(ortamsizDb, ['elvankent-backup.yml/backup'], 'ortamsız veritabanı erişimi yalnız gece yedeği (KI-41 adım 2 ile kapanacak)');
  });
  test('pull_request_target hiç yok; ortamlı (sır taşıyan) iş akışları workflow_run / workflow_call ile tetiklenmez', () => {
    for (const [f, { olaylar, isler }] of Object.entries(hepsi)) {
      assert.ok(!olaylar.includes('pull_request_target'), `${f}: pull_request_target`);
      if (Object.values(isler).some((is) => is.ortam)) {
        assert.deepEqual(olaylar.filter((o) => /^(workflow_run|workflow_call|pull_request)$/.test(o)), [], `${f}: ortamlı iş akışı`);
      }
    }
  });
});

describe('KI-41 H2: yedek saklama süresi alt sınırı (değişkenle yedekler silinemez)', () => {
  const wf = readFileSync(path.join(dir, 'elvankent-backup.yml'), 'utf8');
  const i = wf.indexOf('          gun=$RETENTION_DAYS');
  const blok = wf.slice(i, wf.indexOf('          rclone delete "dest:$BUCKET/db"', i)).split('\n').map((l) => l.replace(/^ {10}/, '')).join('\n');
  const gun = (v) => spawnSync('bash', ['-c', `set -euo pipefail\nRETENTION_DAYS='${v}'\n${blok}\necho "$gun"`], { encoding: 'utf8' }).stdout.trim().split('\n').pop();
  test('silme komutu sınırlanmış değeri kullanır; 0, 7, boş ve geçersiz değer 14/30 olur; 14 ve üstü aynen kalır', () => {
    assert.ok(i > 0);
    assert.match(wf, /rclone delete "dest:\$BUCKET\/db" --min-age "\$\{gun\}d"/);
    assert.doesNotMatch(wf, /--min-age "\$\{RETENTION_DAYS\}d"/);
    assert.equal(gun('0'), '14');
    assert.equal(gun('7'), '14');
    assert.equal(gun('14'), '14');
    assert.equal(gun('30'), '30');
    assert.equal(gun(''), '30');
    assert.equal(gun('1d'), '30');
    assert.equal(gun('-5'), '30');
  });
});
