/**
 * İzinsiz ailelerin adları ofis istemcisine ulaşmaz (DP-03'ün birim karşılığı).
 * Ofis panelinde çalışan istemci bileşenleri kataloğu dolaylı yoldan paketlemesin diye, katalog / manifest
 * derleyicisi / aile meta verisini taşıyan modülleri içe aktaramaz. Önizleme yükü yalnız bağımlılıksız
 * `preview-payload` ile kodlanır (25.11.2026: önizleme penceresi `site-info` üzerinden kataloğu taşıyordu).
 * Çalıştırma: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../../src/components/site-editor/', import.meta.url);
const FORBIDDEN = /from '@\/site-factory\/(site-info|manifest|compile|families|catalog|catalog-meta|catalog\/[^']*)'/;

test('CL-01 site-editor istemci bileşenleri kataloğu taşıyan modülleri içe aktarmaz', () => {
  const files = readdirSync(DIR).filter((f) => /\.tsx?$/.test(f));
  let clients = 0;
  for (const f of files) {
    const src = readFileSync(new URL(f, DIR), 'utf8');
    if (!/^['"]use client['"]/m.test(src)) continue;
    clients++;
    const imports = src.split('\n').filter((l) => /^import (?!type)/.test(l));
    for (const line of imports) assert.ok(!FORBIDDEN.test(line), `${f}: ${line}`);
  }
  assert.ok(clients >= 4, `istemci bileşeni sayısı ${clients}`);
});

test('CL-02 preview-payload bağımlılıksızdır', () => {
  const src = readFileSync(new URL('../../src/site-factory/preview-payload.ts', import.meta.url), 'utf8');
  assert.ok(!/^import /m.test(src), 'preview-payload hiçbir modülü içe aktarmamalı');
});
