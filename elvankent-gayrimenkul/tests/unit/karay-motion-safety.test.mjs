/**
 * KARAYS sayfası hareket güvenliği (tasarım şartnamesi "Canlı Vitrin", bölüm 8 ve 11).
 * karay.css parçalanır (parantez derinliği); her animasyon yalnızca "hareketi azalt" yokken tanımlıdır, metin saydamlaşmaz,
 * sonsuz döngü yalnızca tasarım şeridindedir ve duraklar; dışarıya bağlantı, harici betik ve yeni bağımlılık yoktur.
 * Çalıştırma: npm run test:unit
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const css = readFileSync(new URL('../../src/app/karay/karay.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** CSS'i { seçici/at-kural, bildirimler[], yığın[] } olarak düzleştirir (tırnak ve parantez içi ; ve { yok sayılır) */
function parse(source) {
  const decls = []; // { prop, value, stack }
  const rules = []; // { prelude, stack, body }
  const stack = [];
  let buf = '';
  let quote = '';
  let paren = 0;
  const bodies = [];
  for (const ch of source) {
    if (quote) {
      buf += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === '(') paren++;
    if (ch === ')') paren--;
    if (paren > 0) {
      buf += ch;
      continue;
    }
    if (ch === '{') {
      stack.push(buf.trim());
      bodies.push('');
      buf = '';
    } else if (ch === ';' || ch === '}') {
      const text = buf.trim();
      if (text.includes(':')) {
        const i = text.indexOf(':');
        const decl = { prop: text.slice(0, i).trim(), value: text.slice(i + 1).trim(), stack: [...stack] };
        decls.push(decl);
        if (bodies.length) bodies[bodies.length - 1] += `${decl.prop}:${decl.value};`;
      }
      buf = '';
      if (ch === '}') {
        const prelude = stack.pop();
        const body = bodies.pop();
        rules.push({ prelude, stack: [...stack], body });
      }
    } else buf += ch;
  }
  return { decls, rules };
}
const { decls, rules } = parse(css);
const inNoPref = (stack) => stack.some((p) => p.includes('prefers-reduced-motion: no-preference'));
const COLOR_ONLY = /^(color|background-color|border-color|outline-color|fill|stroke|text-decoration-color|opacity)(\s|,|$)/;

describe('hareket yalnızca "hareketi azalt" yokken', () => {
  test('ayrıştırıcı kuralları buldu', () => {
    assert.ok(rules.length > 100 && decls.length > 300, `${rules.length} kural, ${decls.length} bildirim`);
  });
  test('her @keyframes, animation ve transition "no-preference" bloğundadır (renk geçişleri ve "none" hariç)', () => {
    const offenders = [];
    for (const r of rules) if (r.prelude.startsWith('@keyframes') && !inNoPref(r.stack)) offenders.push(r.prelude);
    for (const d of decls) {
      if (!/^(animation|animation-name|transition)$/.test(d.prop) || inNoPref(d.stack)) continue;
      if (/^none\b/.test(d.value)) continue; // durdurma anahtarı (data-motion="off")
      if (d.prop === 'transition' && d.value.split(',').every((part) => COLOR_ONLY.test(part.trim()))) continue;
      offenders.push(`${d.stack.at(-1)} { ${d.prop}: ${d.value} }`);
    }
    assert.deepEqual(offenders, []);
  });
  test('"hareketi durdur" anahtarı animasyon ve geçişleri kapatır', () => {
    assert.match(css, /\.karay-site\[data-motion='off'\] \*[\s\S]*animation: none !important;\s*transition: none !important/);
  });
});

describe('metin saydamlaşmaz', () => {
  test('opacity yalnızca dekoratif anahtar karelerde (izinli liste)', () => {
    const DECORATIVE = new Set(['@keyframes ky-glow-in', '@keyframes ky-hshadow']);
    const bad = rules.filter((r) => r.prelude.startsWith('@keyframes') && /opacity/.test(r.body) && !DECORATIVE.has(r.prelude)).map((r) => r.prelude);
    assert.deepEqual(bad, []);
  });
  test('ky-rise, ky-enter ve [data-reveal] kuralları opacity içermez', () => {
    const bad = rules.filter((r) => /\.ky-rise|\.ky-enter|data-reveal/.test(r.prelude) && /opacity/.test(r.body)).map((r) => r.prelude);
    assert.deepEqual(bad, []);
    const kf = rules.find((r) => r.prelude === '@keyframes ky-rise');
    assert.ok(kf && !/opacity/.test(kf.body));
  });
  test('bulanıklık en çok 6px', () => {
    for (const d of decls) {
      const m = d.value.match(/blur\((\d+(?:\.\d+)?)px\)/);
      if (m && d.prop === 'filter' && inNoPref(d.stack) && /@keyframes|data-reveal/.test(d.stack.join(' '))) assert.ok(Number(m[1]) <= 6, `${d.stack.at(-1)}: ${d.value}`);
    }
  });
});

describe('sonsuz hareket yalnızca tasarım şeridi', () => {
  test('infinite yalnızca .ky-track ve fare + hareket serbest bloğunda', () => {
    const inf = decls.filter((d) => /\binfinite\b/.test(d.value));
    assert.equal(inf.length, 1);
    assert.equal(inf[0].stack.at(-1), '.ky-track');
    assert.ok(inf[0].stack.some((p) => p.includes('(hover: hover)') && p.includes('prefers-reduced-motion: no-preference')));
  });
  test('şerit fareyle ve klavye odağıyla durur', () => {
    const r = rules.find((x) => x.prelude.includes('.ky-marquee:hover .ky-track') && x.prelude.includes('.ky-marquee:focus-within .ky-track'));
    assert.ok(r && /animation-play-state:paused/.test(r.body));
  });
  test('diğer animasyonlar sonludur (iterasyon sayısı sonlu ya da tek geçiş)', () => {
    for (const d of decls) {
      if (d.prop === 'animation-iteration-count') assert.ok(!/infinite/.test(d.value) || d.stack.at(-1) === '.ky-track');
    }
  });
});

describe('kendi kendine yeterli (self-hosted) ve yeni bağımlılık yok', () => {
  const dir = new URL('../../src/components/karay/', import.meta.url);
  const files = readdirSync(dir).filter((f) => /\.(tsx?|css)$/.test(f));
  test('CSS ve bileşenlerde dış adres, @import url(http) ve <script src yok', () => {
    assert.doesNotMatch(css, /https?:\/\//);
    assert.doesNotMatch(css, /@import\s+url\(\s*['"]?https?:/);
    for (const f of files) {
      const src = readFileSync(new URL(f, dir), 'utf8');
      assert.doesNotMatch(src, /https?:\/\//, f);
      assert.doesNotMatch(src, /<script[^>]*\ssrc=/, f);
    }
    assert.doesNotMatch(readFileSync(new URL('../../src/app/karay/page.tsx', import.meta.url), 'utf8').replace("'https://schema.org'", ''), /https?:\/\//);
  });
  test('animasyon kütüphanesi eklenmedi', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    for (const banned of ['framer-motion', 'motion', 'gsap', 'lottie-web', '@lottiefiles/react-lottie-player', 'react-spring', 'animejs']) {
      assert.ok(!(banned in pkg.dependencies) && !(banned in (pkg.devDependencies ?? {})), banned);
    }
  });
});
