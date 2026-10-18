#!/usr/bin/env node
/**
 * Bir .env dosyasının bash (`set -a; . dosya; set +a`) ve Node (--env-file, process.loadEnvFile)
 * tarafından AYNI değişkenler ve AYNI değerlerle okunduğunu doğrular.
 *
 * CI (elvankent-ci › database) .env.local'ı yazdıktan hemen sonra çalıştırır: dosyayı Node araçları
 * (create-admin, RLS testleri, Playwright yapılandırması) ve "E2E hazırlık" adımında bash okur. İki
 * ayrıştırıcının farklı yorumladığı satır burada açık bir hatayla yakalanır (K-11: tırnaksız
 * `EMAIL_FROM=Ad <e-posta>` satırını Node metin olarak okuyor, bash yönlendirme sanıp düşüyordu).
 *
 * Değerler hiçbir zaman yazdırılmaz; yalnızca değişken adları ve satır numaraları raporlanır.
 *
 * Kullanım: node scripts/check-env-file.mjs .env.local
 * Çıkış kodu: iki taraf aynı okuyorsa 0, okumuyorsa 1, kullanım hatasında 2.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import util from 'node:util';

const file = process.argv[2];
if (!file || typeof util.parseEnv !== 'function') {
  console.error(file ? 'Node 20.12+ gerekir (util.parseEnv)' : 'Kullanım: node scripts/check-env-file.mjs <dosya>');
  process.exit(2);
}
const abs = path.resolve(file);
const text = readFileSync(abs, 'utf8');
const lines = text.split('\n');
const keyAt = (n) => lines[n - 1]?.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)=/)?.[1] ?? '?';

// Node: --env-file ve process.loadEnvFile ile aynı ayrıştırıcı
const fromNode = util.parseEnv(text);

// bash: yalnızca PATH içeren temiz ortamda kaynak alınır; dosyanın tanımladıkları, öncesiyle farktan bulunur
const bash = (script) =>
  spawnSync('bash', ['--noprofile', '--norc', '-c', script, 'bash', abs], { env: { PATH: process.env.PATH ?? '/usr/bin:/bin' }, encoding: 'utf8' });
const toMap = (out) => new Map(out.split('\0').filter(Boolean).map((kv) => [kv.slice(0, kv.indexOf('=')), kv.slice(kv.indexOf('=') + 1)]));
const before = toMap(bash('env -0').stdout);
const sourced = bash('set -euo pipefail; set -a; . "$1"; set +a; env -0');

const problems = [];
if (sourced.status !== 0) {
  // bash'in hata metni satırın kendisini içerebilir: yalnızca satır numarası alınır
  const at = [...new Set([...sourced.stderr.matchAll(/line (\d+)/g)].map((m) => Number(m[1])))];
  problems.push(`bash dosyayı okuyamadı (çıkış ${sourced.status})${at.map((n) => `; satır ${n}: ${keyAt(n)}`).join('')}`);
} else {
  const after = toMap(sourced.stdout);
  for (const [key, value] of Object.entries(fromNode)) {
    if (!after.has(key)) problems.push(`${key}: bash tanımlamıyor`);
    else if (after.get(key) !== value) problems.push(`${key}: bash ve Node farklı değer okuyor`);
  }
  for (const [key, value] of after) {
    if (key !== '_' && before.get(key) !== value && !(key in fromNode)) problems.push(`${key}: yalnızca bash tanımlıyor`);
  }
}
const count = Object.keys(fromNode).length;
if (!problems.length && !count) problems.push('dosyada değişken yok');
if (problems.length) {
  console.error(`✗ ${file}: bash ve Node aynı değerleri okumuyor (değerler gizlendi)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`✓ ${file}: ${count} değişken bash ve Node tarafından aynı değerlerle okunuyor`);
