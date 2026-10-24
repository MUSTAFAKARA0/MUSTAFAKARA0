/**
 * FAZ 3 — Güvenlik yamaları ve yedekleme güvencesi.
 *
 *  SP-01  Bağımlılıklar yamalı: next ≥ 16.3.8, sharp ≥ 0.35.5 (librsvg ≥ 2.63.2), source-map-js ≥ 1.2.2
 *         (package.json, kilit dosyası ve kurulu sürüm birlikte)
 *  SP-02  Dosya imzası: JPEG / PNG / WebP / AVIF tanınır ve gerçek dosyalar kabul edilir
 *  SP-03  SVG / XML (BOM, boşluk, XML bildirimi), GIF, TIFF çözücüye verilmeden "unsupported" (mevcut mesaj metni);
 *         bozuk SVG librsvg'ye hiç ulaşmaz (ulaşsaydı ayrıştırma hatası → "corrupt" olurdu)
 *  SP-04  Tanınmayan içerik "corrupt"; mesaj öncekiyle aynı
 *  SP-05  inspectImage imza denetimini sharp'tan ÖNCE yapar; marka (logo) yolu SVG'yi bilerek kabul etmeye devam eder
 *  BK-01  backup-db.sh: yetkiler korunur, ortak anlık görüntü, parmak izi + tablo sayıları + SHA-256, log'a sayı/boyut yok
 *  BK-02  Yedek iş akışı: betiği kullanır; dört dosya yüklenip doğrulanır; kapalıyken görünür uyarı; eksik ayarların
 *         yalnızca adları; log'a kayıt sayısı / boyut yazılmaz
 *  BK-03  restore-drill.sh: yalnızca YENİ geçici veritabanına (template0) yükler, her durumda siler; SHA-256 → tek
 *         işlem geri yükleme → parmak izi → tablo sayıları → postflight; postflight'ta "HATA" ve "HATA: …" ikisi de sayılır
 *  BK-04  restore-storage.mjs: manifest SHA-256 ile doğrular; bozuk dosya yüklenmez; --verify Supabase'e bağlanmaz;
 *         --apply yalnızca --target ile açıkça yazılan hedef ana makineye yükler
 *  BK-05  backup-storage.mjs: artımlı çalışmada atlanan dosyanın da SHA-256 özeti yazılır
 *  BK-06  Parmak izi ve tablo sayıları sunucu dilinden / saat diliminden bağımsız (collate "C", epoch)
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
const json = (p) => JSON.parse(read(p));
const atLeast = (version, min) => {
  const a = version.replace(/^[^\d]*/, '').split('.').map((n) => parseInt(n, 10));
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  return true;
};

const { inspectImage, sniffImageContainer, MediaValidationError } = await import('@/modules/media/processing');
const sharp = (await import('sharp')).default;
// Mevcut ret mesajı metinleri (değişmemeli)
const UNSUPPORTED = 'Bu dosya desteklenmeyen bir formatta. JPG, PNG, WEBP veya AVIF yükleyin.';
const CORRUPT = 'Dosya okunamadı. Bozuk veya desteklenmeyen bir görsel olabilir.';

describe('SP-01 bağımlılıklar yamalı', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  test('next ≥ 16.3.8 (GHSA-cjq9-62q9-8jv4 ve diğer 16.3.8 bildirimleri)', () => {
    assert.ok(atLeast(pkg.dependencies.next, '16.3.8'), `package.json: ${pkg.dependencies.next}`);
    assert.ok(atLeast(lock.packages['node_modules/next'].version, '16.3.8'), 'kilit dosyası');
    assert.ok(atLeast(json('node_modules/next/package.json').version, '16.3.8'), 'kurulu sürüm');
  });
  test('sharp ≥ 0.35.5 ve librsvg ≥ 2.63.2 (GHSA-wq5f-xc86-pv6w)', () => {
    assert.ok(atLeast(pkg.dependencies.sharp, '0.35.5'), `package.json: ${pkg.dependencies.sharp}`);
    assert.ok(atLeast(lock.packages['node_modules/sharp'].version, '0.35.5'), 'kilit dosyası');
    assert.ok(atLeast(sharp.versions.sharp, '0.35.5'), `kurulu sharp ${sharp.versions.sharp}`);
    assert.ok(atLeast(sharp.versions.rsvg, '2.63.2'), `kurulu librsvg ${sharp.versions.rsvg}`);
  });
  test('kilit dosyasındaki her source-map-js ≥ 1.2.2 (GHSA-68fv-2mgg-jv7q)', () => {
    const entries = Object.entries(lock.packages).filter(([k]) => k.endsWith('node_modules/source-map-js'));
    assert.ok(entries.length > 0);
    for (const [k, v] of entries) assert.ok(atLeast(v.version, '1.2.2'), `${k}: ${v.version}`);
  });
});

describe('SP-02 kabul edilen biçimler', async () => {
  const base = sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 80, b: 40 } } });
  const samples = {
    jpeg: [await base.clone().jpeg().toBuffer(), 'image/jpeg'],
    png: [await base.clone().png().toBuffer(), 'image/png'],
    webp: [await base.clone().webp().toBuffer(), 'image/webp'],
    isobmff: [await base.clone().avif().toBuffer(), 'image/avif'],
  };
  for (const [container, [buf, mime]] of Object.entries(samples)) {
    test(`${container}: imza tanınır, görsel kabul edilir (${mime})`, async () => {
      assert.equal(sniffImageContainer(buf), container);
      assert.deepEqual(await inspectImage(buf), { mime, width: 800, height: 600 });
    });
  }
});

describe('SP-03 SVG ve desteklenmeyen biçimler çözücüye gitmez', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600"/></svg>';
  const variants = {
    'düz SVG': Buffer.from(svg),
    'BOM + boşluk + XML bildirimi': Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`\n  <?xml version="1.0"?>\n${svg}`)]),
    'HTML': Buffer.from('<!doctype html><html><body>x</body></html>'),
  };
  for (const [name, buf] of Object.entries(variants)) {
    test(`${name} → unsupported (mevcut mesaj metni)`, async () => {
      assert.equal(sniffImageContainer(buf), 'svg');
      await assert.rejects(inspectImage(buf), (e) => e instanceof MediaValidationError && e.code === 'unsupported' && e.message === UNSUPPORTED);
    });
  }
  test('bozuk SVG çözücüye hiç ulaşmaz (ulaşsaydı librsvg ayrıştırma hatası → "corrupt" olurdu)', async () => {
    const broken = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect');
    await assert.rejects(sharp(broken, { failOn: 'error' }).metadata(), /XML parse error/, 'kontrol: sharp bu dosyayı librsvg ile ayrıştırmayı dener');
    await assert.rejects(inspectImage(broken), (e) => e.code === 'unsupported' && e.message === UNSUPPORTED);
  });
  const base = sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } } });
  for (const [kind, buf] of [['gif', await base.clone().gif().toBuffer()], ['tiff', await base.clone().tiff().toBuffer()]]) {
    test(`${kind} → unsupported (önceki mesaj)`, async () => {
      assert.equal(sniffImageContainer(buf), kind);
      await assert.rejects(inspectImage(buf), (e) => e.code === 'unsupported' && e.message === UNSUPPORTED);
    });
  }
});

describe('SP-04 tanınmayan içerik', () => {
  for (const [name, buf] of [['metin', Buffer.from('merhaba dünya')], ['PDF başlığı', Buffer.from('%PDF-1.7\n')], ['boş', Buffer.alloc(0)], ['kesik JPEG', Buffer.from([0xff, 0xd8])]]) {
    test(`${name} → corrupt (önceki mesaj)`, async () => {
      assert.equal(sniffImageContainer(buf), null);
      await assert.rejects(inspectImage(buf), (e) => e.code === 'corrupt' && e.message === CORRUPT);
    });
  }
  test('imzası doğru ama bozuk JPEG yine sharp hatasıyla "corrupt"', async () => {
    const buf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
    assert.equal(sniffImageContainer(buf), 'jpeg');
    await assert.rejects(inspectImage(buf), (e) => e.code === 'corrupt' && e.message === CORRUPT);
  });
});

describe('SP-05 sıra ve kapsam', () => {
  const src = read('src/modules/media/processing.ts');
  const body = src.slice(src.indexOf('export async function inspectImage'), src.indexOf('export async function processImage'));
  test('inspectImage: imza denetimi sharp çağrısından önce', () => {
    const sniff = body.indexOf('sniffImageContainer(input)');
    const decode = body.indexOf('sharp(input');
    assert.ok(sniff > 0 && decode > 0, 'iki çağrı da var');
    assert.ok(sniff < decode, 'imza denetimi önce');
    assert.match(body, /if \(!DECODABLE\.has\(container\)\) throw/);
  });
  test('çözücüye izin verilen kapsayıcılar yalnızca JPEG, PNG, WebP, HEIF/AVIF', () => {
    assert.match(src, /const DECODABLE: ReadonlySet<ImageContainer> = new Set\(\['jpeg', 'png', 'webp', 'isobmff'\]\);/);
  });
  test('marka (logo) yolu değişmedi: SVG bilerek kabul edilir (karar D-15 bekliyor)', () => {
    const branding = read('src/modules/media/branding.ts');
    assert.match(branding, /looksLikeSvg/);
    assert.match(branding, /\.\.\.\(svg \? \['svg'\] : \[\]\)/);
  });
});

describe('BK-01 backup-db.sh', () => {
  const sh = read('scripts/backup-db.sh');
  const code = sh.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  test('pg_dump yetkileri korur, custom biçim, ortak anlık görüntü', () => {
    const dump = sh.split('\n').find((l) => /^\s*pg_dump "\$SUPABASE_DB_URL"/.test(l));
    assert.ok(dump, 'pg_dump satırı var');
    assert.doesNotMatch(code, /--no-privileges/);
    assert.match(dump, /--format=custom --no-owner/);
    assert.match(dump, /snap_args/);
    assert.match(code, /select pg_export_snapshot\(\);/);
    assert.match(code, /begin isolation level repeatable read read only;/);
    assert.match(code, /snap_args=\(--snapshot="\$snapshot"\)/);
  });
  test('anlık görüntü oturumu erken kapansa da yedek sürer (coproc değil; süreç kimliği $! ile tutulur)', () => {
    // Faz 3 tatbikatı (F3): coproc kullanılırken oturum hata verip kapanınca bash SNAP_PID'yi sildi ve
    // "set -u" altında betik yedek almadan çıktı. Adlandırılmış boru + $! ile bu yol düzeltildi.
    assert.doesNotMatch(code, /\bcoproc\b|SNAP_PID/);
    assert.match(code, /snap_pid=\$!/);
    assert.match(code, /mkfifo /);
    assert.match(code, /trap '' PIPE/);
  });
  test('çıktı yolu tek tırnak veya ters bölü içeremez (psql \\o argümanı); bağlanmadan ve klasör açmadan durur', () => {
    // Her çalıştırmada yeni bir üst klasör: önceki bir çalıştırmadan kalan klasör sonucu etkilemez
    const base = mkdtempSync(path.join(tmpdir(), 'karay-yol-'));
    try {
      for (const bad of [path.join(base, "a'b"), path.join(base, 'a\\b')]) {
        const r = spawnSync('bash', [root + 'scripts/backup-db.sh'], {
          encoding: 'utf8',
          env: { ...process.env, SUPABASE_DB_URL: 'postgresql://birim-test@127.0.0.1:9/yok', OUT_DIR: bad },
        });
        assert.equal(r.status, 1, r.stderr);
        assert.match(r.stderr, /tek tırnak veya ters bölü/);
        assert.ok(!existsSync(bad), 'klasör oluşturulmadı');
      }
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
  test('parmak izi ve tablo sayıları aynı oturumda; RLS sessizce süzemez', () => {
    assert.match(code, /backup_fingerprint\.sql/);
    assert.match(code, /backup_table_counts\.sql/);
    assert.match(code, /set row_security = off/);
  });
  test('SHA-256 özeti, okunabilirlik ve biçim denetimi', () => {
    assert.match(code, /"\$NAME\.dump" "\$NAME\.fingerprint\.txt" "\$NAME\.tables\.txt" > "\$NAME\.sha256"/);
    assert.match(code, /pg_restore --list "\$BASE\.dump"/);
    assert.match(code, /set -euo pipefail/);
  });
  test('log: kayıt sayısı, boyut, bağlantı adresi yazılmaz', () => {
    assert.doesNotMatch(code, /cut -d'\|'|ls -l|wc -c|du -|stat -c|cat "\$BASE/);
    assert.doesNotMatch(code, /echo[^\n]*\$SUPABASE_DB_URL/);
    assert.match(code, /redact\(\)/);
  });
  test('hata mesajında bağlantı adresi, sunucu, kullanıcı, rol ve veritabanı adı gizlenir', () => {
    const fn = code.split('\n').find((l) => l.startsWith('redact()'));
    assert.ok(fn, 'redact() tek satır');
    const input = [
      'pg_dump: error: connection to server at "10.1.2.3", port 5432 failed: FATAL:  password authentication failed for user "postgres.abcdef"',
      'psql: error: could not translate host name "db.abcdef.supabase.co" to address',
      'FATAL:  role "yedek_rol" does not exist',
      'FATAL:  database "canli_db" does not exist',
      'adres: postgresql://postgres.abcdef:Gizli-Parola@aws-0.pooler.supabase.com:5432/postgres?sslmode=require',
    ].join('\n');
    const r = spawnSync('bash', ['-c', `${fn}\nredact`], { input, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    for (const secret of ['10.1.2.3', 'abcdef', 'yedek_rol', 'canli_db', 'Gizli-Parola', 'pooler.supabase.com']) assert.ok(!r.stdout.includes(secret), secret);
    assert.equal(r.stdout.split('\n').filter(Boolean).length, 5, 'satırlar korunur, yalnızca değerler gizlenir');
  });
});

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

describe('BK-03 restore-drill.sh', () => {
  const sh = read('scripts/restore-drill.sh');
  const code = sh.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  test('yalnızca YENİ geçici veritabanı; her durumda silinir', () => {
    assert.match(code, /TMPDB="karay_restore_drill_\$\(date -u \+%Y%m%d%H%M%S\)_\$\$"/);
    assert.match(code, /create database \\"\$TMPDB\\" template template0/);
    assert.match(code, /trap cleanup EXIT/);
    assert.match(code, /drop database if exists \\"\$TMPDB\\" with \(force\)/);
    assert.match(code, /--dbname "\$TARGET_URL"/);
    assert.doesNotMatch(code, /--dbname "\$ADMIN_DB_URL"|--clean/);
  });
  test('sıra: SHA-256 → tek işlem geri yükleme → parmak izi → tablo sayıları → postflight', () => {
    const order = ['-c --quiet', 'pg_restore --list', 'create database', '--single-transaction --exit-on-error', 'backup_fingerprint.sql', 'backup_table_counts.sql', 'postflight_v2.sql'].map((s) => code.indexOf(s));
    assert.ok(order.every((i) => i > 0), JSON.stringify(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.doesNotMatch(code, /--no-privileges/);
  });
  test('son kontrol: "HATA" ve "HATA: <ayrıntı>" satırlarının ikisi de sayılır', () => {
    const line = code.split('\n').find((l) => l.startsWith('errors=$(awk'));
    assert.ok(line, 'errors= satırı var');
    const work = mkdtempSync(path.join(tmpdir(), 'karay-postflight-'));
    const rows = ['1|tablolar|20 / 20|TAMAM', '2|RLS|-|HATA: RLS kapalı tablo var', '3|roller|0|HATA', '4|ilanlar|12|preflight ile KARŞILAŞTIRIN'];
    writeFileSync(path.join(work, 'postflight.txt'), rows.join('\n') + '\n');
    const r = spawnSync('bash', ['-c', `${line}\necho "$errors"`], { encoding: 'utf8', env: { ...process.env, WORK: work } });
    rmSync(work, { recursive: true });
    assert.equal(r.stdout.trim(), '2', r.stderr);
  });
});

describe('BK-04 restore-storage.mjs SHA-256 doğrulaması', () => {
  const run = (dir, ...args) => spawnSync(process.execPath, [root + 'scripts/restore-storage.mjs', `--from=${dir}`, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_SERVICE_ROLE_KEY: 'birim-test' },
  });
  const make = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'karay-restore-'));
    mkdirSync(path.join(dir, 'media', 'org'), { recursive: true });
    const body = Buffer.from('görsel-baytları');
    writeFileSync(path.join(dir, 'media', 'org', 'a.webp'), body);
    const manifest = { buckets: { media: { files: [{ path: 'org/a.webp', size: body.length, sha256: createHash('sha256').update(body).digest('hex') }] } } };
    writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest));
    return dir;
  };
  test('--verify: özet aynıysa 0', () => {
    const dir = make();
    const r = run(dir, '--verify');
    rmSync(dir, { recursive: true });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /SHA-256 doğrulanan 1/);
  });
  test('--verify: bozuk dosya 2; kuru çalıştırmada da yüklenmez', () => {
    const dir = make();
    writeFileSync(path.join(dir, 'media', 'org', 'a.webp'), 'bozuk');
    const verify = run(dir, '--verify');
    const dry = run(dir);
    rmSync(dir, { recursive: true });
    assert.equal(verify.status, 2);
    assert.match(verify.stderr, /SHA-256 manifest ile uyuşmuyor/);
    assert.equal(dry.status, 2);
    assert.match(dry.stderr, /yüklenmedi/);
  });
  test('--verify: manifest\'te olup klasörde olmayan dosya 2; manifest yoksa 1', () => {
    const dir = make();
    rmSync(path.join(dir, 'media', 'org', 'a.webp'));
    const missing = run(dir, '--verify');
    rmSync(path.join(dir, 'manifest.json'));
    const noManifest = run(dir, '--verify');
    rmSync(dir, { recursive: true });
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /yedek klasöründe yok/);
    assert.equal(noManifest.status, 1);
  });
  test('--apply hedef ana makine --target ile açıkça yazılmadan hiçbir şey yüklemez (yanlış proje koruması)', () => {
    const dir = make();
    const none = run(dir, '--apply');
    const wrong = run(dir, '--apply', '--target=baska-proje.supabase.co');
    const right = run(dir, '--apply', '--target=127.0.0.1:9');
    rmSync(dir, { recursive: true });
    assert.match(right.stdout, /GERİ YÜKLEME → 127\.0\.0\.1:9/, 'doğru hedefle yüklemeye geçer');
    for (const r of [none, wrong]) {
      assert.equal(r.status, 1, r.stderr);
      assert.match(r.stderr, /--target=127\.0\.0\.1:9/);
      assert.doesNotMatch(r.stdout, /GERİ YÜKLEME/);
    }
  });
});

describe('BK-05 / BK-06 yedek içerik denetimi', () => {
  test('backup-storage: atlanan dosyanın SHA-256 özeti de manifest\'e yazılır', () => {
    assert.match(read('scripts/backup-storage.mjs'), /skipped: true, sha256: createHash\('sha256'\)\.update\(readFileSync\(target\)\)/);
  });
  test('parmak izi: metin sıralamaları collate "C", zaman damgaları epoch', () => {
    const fp = read('supabase/ops/backup_fingerprint.sql');
    assert.doesNotMatch(fp, /updated_at::text/);
    assert.match(fp, /order by hostname collate "C"/);
    assert.match(fp, /key collate "C"/);
    assert.match(fp, /order by bucket_id collate "C", name collate "C"/);
    assert.doesNotMatch(fp, /\bemail\b|full_name|phone/, 'kişisel alan okunmaz');
  });
  test('tablo sayıları: yalnızca sayım; sıralama collate "C"; yetkisiz tablo atlanır', () => {
    const t = read('supabase/ops/backup_table_counts.sql');
    assert.match(t, /count\(\*\)/);
    assert.match(t, /has_table_privilege\(c\.oid, 'select'\)/);
    assert.match(t, /order by n\.nspname collate "C", c\.relname collate "C"/);
  });
});
