#!/usr/bin/env node
/**
 * Statik marka ve demo görsellerini üretir:
 *  - public/demo/{sahne}/w{320,640,960,1440,1920}.webp → DEMO ilanlarda kullanılan
 *    illüstrasyonlar ("yumuşak 3B" stil). Bunlar gerçek mülk fotoğrafı DEĞİLDİR ve
 *    üzerlerinde "DEMO GÖRSEL" etiketi bulunur.
 *  - public/placeholder-property.svg → fotoğrafı olmayan ilanlar için yer tutucu
 *  - src/app/icon.svg, src/app/apple-icon.png, src/app/favicon.ico → varsayılan favicon seti
 *  - public/og-default.png → yedek paylaşım görseli
 *
 * Varyant düzeni, yüklenen fotoğraflar için sunucuda üretilen varyantlarla aynıdır
 * (bkz. src/modules/media/variants.ts); demo kayıtları `public_base = /demo/{sahne}`
 * ve `variant_widths = {320,640,960,1440,1920}` ile saklanır.
 *
 * Kullanım: node scripts/generate-assets.mjs
 */
import sharp from 'sharp';
import { mkdir, rm, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const W = 1920;
const H = 1280;
const WIDTHS = [320, 640, 960, 1440, 1920];

const brand = { primary: '#0E4D45', primaryDark: '#0A3832', accent: '#B5813A', cream: '#F7F5F0' };

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
const f = (n) => Math.round(n * 10) / 10;
const lin = (id, stops, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</linearGradient>`;
const rad = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops
    .map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`)
    .join('')}</radialGradient>`;

const rect = (x, y, w, h, fill, extra = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" ${extra}/>`;
const rrect = (x, y, w, h, r, fill, extra = '') => rect(x, y, w, h, fill, `rx="${r}" ${extra}`);
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" ${extra}/>`;
const ellipse = (cx, cy, rx, ry, fill, extra = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${fill}" ${extra}/>`;
/** Yumuşak temas gölgesi (ambient occlusion) */
const shadow = (cx, cy, rx, ry, opacity = 0.28, blur = 'blurL') => ellipse(cx, cy, rx, ry, '#2B2018', `opacity="${opacity}" filter="url(#${blur})"`);
/** Yuvarlak taçlı ağaç (üç tonlu yeşil) */
function tree(x, groundY, s = 1, tone = 'g') {
  const pal = tone === 'olive' ? ['#8A9A6B', '#6F7F55', '#56643F'] : ['#7FA06F', '#5F805A', '#476745'];
  return `
    ${shadow(x + 30 * s, groundY + 4, 120 * s, 22 * s, 0.25)}
    ${rrect(x - 9 * s, groundY - 150 * s, 18 * s, 150 * s, 8 * s, '#6B4F3A')}
    ${circle(x, groundY - 220 * s, 110 * s, pal[2])}
    ${circle(x - 45 * s, groundY - 200 * s, 80 * s, pal[1])}
    ${circle(x + 40 * s, groundY - 245 * s, 85 * s, pal[0])}
    ${circle(x - 20 * s, groundY - 275 * s, 60 * s, pal[0], 'opacity="0.85"')}`;
}

/** Selvi / kavak tipi ince ağaç */
function cypress(x, groundY, s = 1) {
  return `
    ${shadow(x + 20 * s, groundY + 3, 50 * s, 12 * s, 0.22)}
    ${ellipse(x, groundY - 150 * s, 42 * s, 160 * s, '#4E6E4B')}
    ${ellipse(x - 10 * s, groundY - 170 * s, 22 * s, 120 * s, '#6A8B63', 'opacity="0.8"')}`;
}

function plantPot(x, y, s = 1) {
  return `
    ${shadow(x, y + 4, 70 * s, 12 * s, 0.3, 'blurM')}
    <path d="M ${x - 50 * s} ${y - 110 * s} L ${x + 50 * s} ${y - 110 * s} L ${x + 38 * s} ${y} L ${x - 38 * s} ${y} Z" fill="#C98A5E"/>
    ${rect(x - 54 * s, y - 118 * s, 108 * s, 14 * s, '#B87850', `rx="${6 * s}"`)}
    ${ellipse(x - 40 * s, y - 190 * s, 42 * s, 90 * s, '#5F805A', `transform="rotate(-24 ${x - 40 * s} ${y - 190 * s})"`)}
    ${ellipse(x + 40 * s, y - 200 * s, 40 * s, 95 * s, '#4F7050', `transform="rotate(22 ${x + 40 * s} ${y - 200 * s})"`)}
    ${ellipse(x, y - 230 * s, 36 * s, 110 * s, '#7FA06F')}`;
}

function windowGlass(id, x, y, w, h, frame = '#FFFFFF', t = 14, sky = ['#BFD8E4', '#E9F1F2']) {
  return `
    <defs>${lin(id, [[0, sky[0]], [1, sky[1]]])}</defs>
    ${rect(x, y, w, h, frame)}
    ${rect(x + t, y + t, w - 2 * t, h - 2 * t, `url(#${id})`)}
    <path d="M ${x + t} ${y + h * 0.62} L ${x + w * 0.55} ${y + t} L ${x + w * 0.72} ${y + t} L ${x + t} ${y + h * 0.9} Z" fill="#FFFFFF" opacity="0.28"/>`;
}

function facadeWindows(x, y, cols, rows, w, h, gx, gy, lit = [], railing = false) {
  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const wx = x + c * (w + gx);
      const wy = y + r * (h + gy);
      out += rect(wx - 6, wy - 6, w + 12, h + 12, '#FFFFFF', 'opacity="0.85"');
      out += rect(wx, wy, w, h, lit.includes(i) ? 'url(#litGlass)' : 'url(#glass)');
      out += `<path d="M ${wx} ${wy + h * 0.7} L ${wx + w * 0.6} ${wy} L ${wx + w * 0.78} ${wy} L ${wx} ${wy + h * 0.95} Z" fill="#FFFFFF" opacity="0.22"/>`;
      if (railing) {
        out += rect(wx - 14, wy + h * 0.62, w + 28, h * 0.38 + 8, '#DDEBEF', 'opacity="0.55"');
        out += rect(wx - 14, wy + h * 0.62, w + 28, 5, '#FFFFFF');
      }
    }
  }
  return out;
}

const sky = (top = '#AFCFE0', mid = '#D6E6EC', bottom = '#F6EBDD') => `
  <defs>${lin('sky', [[0, top], [0.55, mid], [1, bottom]])}${rad('sun', [[0, '#FFF6DF', 0.95], [0.35, '#FFE9C2', 0.45], [1, '#FFE9C2', 0]], 0.5, 0.5, 0.5)}</defs>
  ${rect(0, 0, W, H, 'url(#sky)')}`;

const clouds = (y = 180) => `
  <g fill="#FFFFFF" opacity="0.75" filter="url(#blurS)">
    ${ellipse(360, y, 170, 38, '#FFFFFF')}${ellipse(470, y - 22, 110, 36, '#FFFFFF')}
    ${ellipse(1380, y + 60, 210, 42, '#FFFFFF')}${ellipse(1500, y + 34, 120, 36, '#FFFFFF')}
  </g>`;

const commonDefs = `
  <defs>
    <filter id="blurS" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="blurM" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="blurL" x="-50%" y="-80%" width="200%" height="260%"><feGaussianBlur stdDeviation="24"/></filter>
    <filter id="blurXL" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.45  0 0 0 0 0.4  0 0 0 0.09 0"/>
    </filter>
    ${rad('vignette', [[0.55, '#000000', 0], [1, '#1B140E', 0.3]], 0.5, 0.46, 0.78)}
    ${lin('glass', [[0, '#8FB3C2'], [1, '#C9DDE4']])}
    ${lin('litGlass', [[0, '#F2D39A'], [1, '#F8E6C2']])}
  </defs>`;

const finish = () => `
  ${rect(0, 0, W, H, '#000', 'filter="url(#grain)"')}
  ${rect(0, 0, W, H, 'url(#vignette)')}
  <!-- Etiket alt ortada: kart ve galeri köşelerindeki düğme/rozetlerle çakışmaz -->
  <g transform="translate(${(W - 286) / 2}, ${H - 112})">
    <rect width="286" height="68" rx="34" fill="#0A1F1C" fill-opacity="0.72"/>
    <text x="143" y="44" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="3.5" fill="#F7F5F0">DEMO GÖRSEL</text>
  </g>`;

// ---------------------------------------------------------------------------
// Sahneler (1920×1280, ışık sol üstten)
// ---------------------------------------------------------------------------
const scenes = {
  'apartment-facade': () => `
    ${sky()}
    ${ellipse(1560, 230, 260, 260, 'url(#sun)')}
    ${clouds(210)}
    <!-- uzak bloklar (atmosfer perspektifi) -->
    <g opacity="0.55">${rect(60, 520, 260, 520, '#C7D3D6')}${rect(1560, 470, 300, 570, '#C4D0D4')}${rect(1420, 600, 180, 440, '#D2DCDE')}</g>
    <defs>${lin('facadeA', [[0, '#F1E6D6'], [1, '#D9C6AC']])}${lin('facadeB', [[0, '#E4D3BC'], [1, '#C8B08F']])}${lin('facadeSide', [[0, '#C9B294'], [1, '#A88E6E']])}</defs>
    ${shadow(930, 1060, 820, 60, 0.35)}
    <!-- ana blok -->
    ${rect(360, 250, 620, 810, 'url(#facadeA)')}
    ${rect(980, 290, 120, 770, 'url(#facadeSide)')}
    ${rect(340, 228, 660, 34, '#B79F82', 'rx="6"')}
    ${facadeWindows(412, 300, 4, 7, 92, 80, 46, 30, [2, 9, 15, 22], true)}
    <!-- ikinci blok -->
    ${rect(1120, 360, 520, 700, 'url(#facadeB)')}
    ${rect(1100, 338, 560, 30, '#A88F72', 'rx="6"')}
    ${facadeWindows(1168, 410, 3, 6, 104, 82, 52, 32, [1, 7, 13])}
    ${Array.from({ length: 6 }, (_, i) => rect(1150, 506 + i * 114, 460, 10, '#8E7760', 'opacity="0.6"')).join('')}
    <!-- giriş -->
    ${rect(600, 930, 140, 130, '#5B4A3A', 'rx="4"')}${rect(580, 910, 180, 22, '#3F4A48', 'rx="4"')}
    ${rect(1320, 940, 120, 120, '#5B4A3A', 'rx="4"')}
    <!-- zemin, kaldırım, yol -->
    <defs>${lin('grass', [[0, '#9CB58E'], [1, '#7E9A70']])}${lin('road', [[0, '#7A7F80'], [1, '#5F6566']])}</defs>
    ${rect(0, 1040, W, 60, 'url(#grass)')}
    ${rect(0, 1096, W, 34, '#E4DDD0')}
    ${rect(0, 1128, W, 152, 'url(#road)')}
    ${Array.from({ length: 12 }, (_, i) => rect(40 + i * 170, 1200, 90, 10, '#EDE7DC', 'rx="5"')).join('')}
    ${tree(210, 1060, 1.05)}${tree(1780, 1060, 1.1)}${tree(1080, 1070, 0.7)}
    ${plantPot(880, 1060, 0.55)}`,

  'living-room': () => `
    <defs>${lin('wall', [[0, '#F3ECE1'], [1, '#E6DCCB']])}${lin('floor', [[0, '#C9A77F'], [1, '#A7825C']])}${rad('beam', [[0, '#FFF3D6', 0.75], [1, '#FFF3D6', 0]], 0.5, 0.5, 0.5)}</defs>
    ${rect(0, 0, W, 900, 'url(#wall)')}
    ${rect(0, 900, W, 380, 'url(#floor)')}
    ${Array.from({ length: 11 }, (_, i) => rect(i * 190, 900, 3, 380, '#9A7752', 'opacity="0.45"')).join('')}
    ${rect(0, 892, W, 14, '#FFFFFF', 'opacity="0.9"')}
    <!-- büyük pencere + manzara -->
    ${windowGlass('win1', 1150, 130, 620, 640)}
    <g opacity="0.85">${rect(1180, 520, 90, 220, '#A9C3CC')}${rect(1290, 470, 120, 270, '#B8CDD4')}${rect(1430, 560, 100, 180, '#A1BCC6')}${rect(1560, 500, 160, 240, '#B2C8CF')}</g>
    ${circle(1250, 690, 80, '#7FA06F', 'opacity="0.9"')}${circle(1650, 700, 70, '#6F9064', 'opacity="0.9"')}
    ${rect(1454, 130, 12, 640, '#FFFFFF')}
    ${ellipse(1280, 1080, 520, 150, 'url(#beam)', 'transform="rotate(-8 1280 1080)"')}
    <!-- perde -->
    <defs>${lin('curtain', [[0, '#EFE6D6'], [0.5, '#E3D6C0'], [1, '#EFE6D6']], 1, 0)}</defs>
    ${rect(1060, 110, 110, 700, 'url(#curtain)', 'rx="10"')}${rect(1040, 100, 780, 14, '#B8A58B', 'rx="7"')}
    <!-- tablo -->
    ${shadow(620, 380, 190, 40, 0.18, 'blurM')}
    ${rect(430, 190, 380, 250, '#FFFFFF', 'rx="6"')}
    <defs>${lin('art', [[0, '#D9A46A'], [1, '#B5813A']])}</defs>
    ${rect(452, 212, 336, 206, '#F3E9DA')}
    <path d="M452 418 L560 300 L640 360 L720 290 L788 350 L788 418 Z" fill="url(#art)" opacity="0.9"/>
    ${circle(700, 262, 26, '#E8C48F')}
    <!-- kanepe -->
    ${shadow(640, 905, 470, 50, 0.4)}
    <defs>${lin('sofa', [[0, '#1B6A5F'], [1, '#0E4D45']])}${lin('sofaSeat', [[0, '#237A6D'], [1, '#155E54']])}</defs>
    ${rrect(210, 560, 860, 200, 60, 'url(#sofa)')}
    ${rrect(180, 700, 920, 190, 50, 'url(#sofaSeat)')}
    ${rrect(160, 640, 120, 250, 50, '#0C443D')}${rrect(1000, 640, 120, 250, 50, '#0C443D')}
    ${rrect(330, 610, 170, 150, 40, '#B5813A')}${rrect(760, 612, 170, 150, 40, '#E8DCC6')}
    ${rrect(540, 640, 150, 120, 36, '#D9C3A0')}
    ${rect(230, 885, 22, 40, '#3B2E24')}${rect(1030, 885, 22, 40, '#3B2E24')}
    <!-- halı + sehpa -->
    ${ellipse(700, 1080, 560, 120, '#E9DFCF')}
    ${ellipse(700, 1080, 500, 100, '#E2D5C0')}
    ${shadow(700, 1040, 260, 30, 0.35, 'blurM')}
    <defs>${lin('wood', [[0, '#8A6644'], [1, '#6A4C32']])}</defs>
    ${rrect(460, 960, 480, 36, 14, 'url(#wood)')}
    ${rect(500, 996, 18, 60, '#5A3F29')}${rect(882, 996, 18, 60, '#5A3F29')}
    ${rrect(560, 930, 110, 32, 8, '#F3EEE6')}${circle(800, 944, 22, '#7FA06F')}
    <!-- lambader ve bitki -->
    ${shadow(1880, 1000, 80, 16, 0.3, 'blurM')}${rect(1860, 470, 8, 530, '#3B3B3B')}
    <path d="M 1810 470 L 1918 470 L 1896 390 L 1832 390 Z" fill="#F4E6CC"/>
    ${plantPot(1100, 1000, 0.95)}`,

  kitchen: () => `
    <defs>${lin('wallK', [[0, '#F5F0E8'], [1, '#E9E1D4']])}${lin('floorK', [[0, '#D9CBB7'], [1, '#BCA98F']])}</defs>
    ${rect(0, 0, W, 960, 'url(#wallK)')}
    ${rect(0, 960, W, 320, 'url(#floorK)')}
    ${Array.from({ length: 9 }, (_, i) => rect(i * 240, 960, 2, 320, '#A89478', 'opacity="0.5"')).join('')}
    <!-- pencere -->
    ${windowGlass('winK', 1380, 150, 420, 420)}
    ${circle(1520, 470, 70, '#7FA06F', 'opacity="0.85"')}${circle(1660, 500, 55, '#6F9064', 'opacity="0.85"')}
    <!-- üst dolaplar -->
    ${shadow(700, 420, 600, 30, 0.18, 'blurM')}
    ${Array.from({ length: 5 }, (_, i) => `${rrect(120 + i * 232, 150, 222, 250, 8, '#FBF8F3', 'stroke="#E4DBCD" stroke-width="3"')}${rect(215 + i * 232, 360, 34, 6, '#B5813A', 'rx="3"')}`).join('')}
    <!-- tezgah arkası (fayans) -->
    ${Array.from({ length: 3 }, (_, r) => Array.from({ length: 14 }, (_, c) => rrect(120 + c * 83 + (r % 2) * 40, 440 + r * 46, 78, 42, 6, '#EFEAE2', 'stroke="#E0D7C9" stroke-width="2"')).join('')).join('')}
    <!-- tezgah ve alt dolaplar -->
    <defs>${lin('cab', [[0, '#16655A'], [1, '#0E4D45']])}</defs>
    ${rect(120, 580, 1240, 34, '#3E4A48', 'rx="6"')}
    ${rect(130, 614, 1220, 300, 'url(#cab)')}
    ${Array.from({ length: 5 }, (_, i) => `${rrect(146 + i * 242, 632, 226, 262, 8, '#135C52')}${rect(234 + i * 242, 652, 50, 8, '#C99A57', 'rx="4"')}`).join('')}
    ${rect(560, 540, 230, 42, '#2B2F31', 'rx="6"')}${rect(1010, 490, 16, 92, '#A7AFB2', 'rx="6"')}${rect(1010, 490, 70, 14, '#A7AFB2', 'rx="6"')}
    <!-- ada + taburelер -->
    ${shadow(1180, 1190, 520, 50, 0.4)}
    <defs>${lin('island', [[0, '#F7F3EC'], [1, '#E3D9C9']])}</defs>
    ${rrect(700, 880, 960, 60, 14, '#FFFFFF')}
    ${rect(730, 940, 900, 240, 'url(#island)')}
    ${Array.from({ length: 3 }, (_, i) => `${shadow(880 + i * 280, 1245, 90, 16, 0.35, 'blurM')}${rect(870 + i * 280, 1040, 12, 200, '#3B3B3B')}${rrect(810 + i * 280, 1010, 130, 34, 17, '#B5813A')}`).join('')}
    <!-- sarkıt lambalar -->
    ${[900, 1180, 1460].map((x) => `${rect(x - 2, 0, 4, 250, '#3B3B3B')}<path d="M ${x - 70} 320 Q ${x} 220 ${x + 70} 320 Z" fill="#2E3A38"/>${ellipse(x, 330, 60, 14, '#FFE7B8', 'opacity="0.9" filter="url(#blurS)"')}`).join('')}
    ${plantPot(1780, 960, 0.8)}`,

  bedroom: () => `
    <defs>${lin('wallB', [[0, '#EEF1EF'], [1, '#DDE3E0']])}${lin('floorB', [[0, '#C8AE8E'], [1, '#A88C6B']])}</defs>
    ${rect(0, 0, W, 920, 'url(#wallB)')}
    ${rect(0, 920, W, 360, 'url(#floorB)')}
    ${Array.from({ length: 10 }, (_, i) => rect(i * 200, 920, 3, 360, '#9A7F60', 'opacity="0.45"')).join('')}
    ${windowGlass('winB', 1300, 150, 480, 560)}
    ${rect(1250, 130, 120, 640, '#E8DCCB', 'rx="10"')}${rect(1710, 130, 120, 640, '#E8DCCB', 'rx="10"')}
    ${rect(1230, 118, 620, 14, '#B8A58B', 'rx="7"')}
    <!-- yatak başlığı -->
    ${shadow(640, 520, 420, 40, 0.18, 'blurM')}
    <defs>${lin('head', [[0, '#8C735D'], [1, '#6E5642']])}</defs>
    ${rrect(250, 360, 780, 330, 36, 'url(#head)')}
    ${Array.from({ length: 5 }, (_, i) => rect(300 + i * 150, 395, 3, 260, '#5E4838', 'opacity="0.5"')).join('')}
    <!-- yatak -->
    ${shadow(640, 1010, 520, 60, 0.4)}
    ${rrect(200, 660, 880, 220, 30, '#FFFFFF')}
    <defs>${lin('duvet', [[0, '#A9C1C6'], [1, '#86A3AA']])}</defs>
    ${rrect(180, 760, 920, 230, 36, 'url(#duvet)')}
    <path d="M 200 800 Q 640 850 1080 790" stroke="#7B979E" stroke-width="6" fill="none" opacity="0.6"/>
    ${rrect(290, 600, 240, 110, 40, '#F8F5EF')}${rrect(750, 600, 240, 110, 40, '#F8F5EF')}
    ${rrect(520, 640, 240, 90, 36, '#D8B98F')}
    <!-- komodinler + lambalar -->
    ${[110, 1170].map((x) => `${shadow(x + 50, 990, 90, 16, 0.3, 'blurM')}${rrect(x, 780, 110, 200, 10, '#8E7760')}${rect(x + 20, 840, 70, 6, '#C99A57', 'rx="3"')}${rect(x + 50, 690, 8, 90, '#4A4A4A')}<path d="M ${x + 14} 700 L ${x + 96} 700 L ${x + 80} 630 L ${x + 30} 630 Z" fill="#F4E6CC"/>${ellipse(x + 55, 700, 70, 30, '#FFE9C2', 'opacity="0.55" filter="url(#blurM)"')}`).join('')}
    ${ellipse(640, 1150, 520, 90, '#E8DCCA', 'opacity="0.8"')}
    ${plantPot(1560, 1050, 0.9)}`,

  bathroom: () => `
    <defs>${lin('wallT', [[0, '#F3F5F4'], [1, '#E3E8E6']])}</defs>
    ${rect(0, 0, W, H, 'url(#wallT)')}
    ${Array.from({ length: 12 }, (_, r) => Array.from({ length: 16 }, (_, c) => rect(c * 122, r * 82, 120, 80, (r + c) % 2 ? '#E9EDEC' : '#F1F4F3')).join('')).join('')}
    <defs>${lin('floorT', [[0, '#9DA8A6'], [1, '#7F8B89']])}</defs>
    ${rect(0, 1000, W, 280, 'url(#floorT)')}
    <!-- küvet -->
    ${shadow(560, 1010, 440, 40, 0.35)}
    <defs>${lin('tub', [[0, '#FFFFFF'], [1, '#E7ECEB']])}</defs>
    ${rrect(160, 700, 800, 300, 60, 'url(#tub)', 'stroke="#D5DBDA" stroke-width="5"')}
    ${rrect(200, 720, 720, 60, 30, '#DDEBEF')}
    ${rect(820, 470, 14, 250, '#AAB3B5', 'rx="6"')}${rrect(760, 460, 140, 20, 10, '#AAB3B5')}
    <!-- lavabo dolabı + ayna -->
    ${shadow(1440, 1010, 280, 34, 0.35)}
    ${rrect(1180, 610, 520, 40, 12, '#FFFFFF')}
    <defs>${lin('vanity', [[0, '#16655A'], [1, '#0E4D45']])}</defs>
    ${rect(1200, 650, 480, 330, 'url(#vanity)')}
    ${rrect(1220, 670, 215, 290, 8, '#135C52')}${rrect(1445, 670, 215, 290, 8, '#135C52')}
    ${rect(1300, 690, 50, 8, '#C99A57', 'rx="4"')}${rect(1530, 690, 50, 8, '#C99A57', 'rx="4"')}
    ${shadow(1440, 520, 180, 30, 0.15, 'blurM')}
    <defs>${lin('mirror', [[0, '#DDEBEF'], [1, '#C4D8DE']])}</defs>
    ${rrect(1290, 170, 300, 380, 150, 'url(#mirror)', 'stroke="#C99A57" stroke-width="10"')}
    <path d="M 1330 420 L 1470 230 L 1520 240 L 1350 470 Z" fill="#FFFFFF" opacity="0.35"/>
    ${rect(1432, 540, 16, 70, '#AAB3B5', 'rx="6"')}
    <!-- havlu ve bitki -->
    ${rect(1040, 380, 120, 14, '#AAB3B5', 'rx="7"')}${rrect(1050, 394, 100, 240, 12, '#E8D8BF')}${rect(1050, 590, 100, 12, '#D6C09E')}
    ${plantPot(1800, 1000, 0.75)}`,

  land: () => `
    ${sky('#A9CCE0', '#D8E8EE', '#F7EEDF')}
    ${ellipse(420, 250, 240, 240, 'url(#sun)')}
    ${clouds(200)}
    <path d="M0 640 Q 260 520 560 600 T 1180 560 T 1920 590 L 1920 820 L 0 820 Z" fill="#AFC0B7" opacity="0.75"/>
    <path d="M0 700 Q 420 610 860 690 T 1920 660 L 1920 1280 L 0 1280 Z" fill="#A8BA8D"/>
    <defs>${lin('plot', [[0, '#D6C38E'], [1, '#B99F68']])}</defs>
    <path d="M 260 900 L 1500 820 L 1780 1180 L 120 1250 Z" fill="url(#plot)"/>
    ${Array.from({ length: 18 }, (_, i) => `<path d="M ${150 + i * 95} 1250 L ${300 + i * 72} 900" stroke="#A68D5A" stroke-width="5" opacity="0.55"/>`).join('')}
    <!-- sınır kazıkları ve ip -->
    <path d="M 260 900 L 1500 820 L 1780 1180 L 120 1250 Z" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-dasharray="18 14" opacity="0.9"/>
    ${[[260, 900], [1500, 820], [1780, 1180], [120, 1250]].map(([x, y]) => `${shadow(x + 10, y + 4, 26, 8, 0.4, 'blurS')}${rect(x - 7, y - 70, 14, 72, '#E07A5F', 'rx="3"')}${rect(x - 7, y - 70, 14, 16, '#FFFFFF', 'rx="3"')}`).join('')}
    ${tree(1700, 760, 0.7, 'olive')}${tree(1830, 780, 0.55, 'olive')}${cypress(200, 720, 0.8)}${cypress(260, 730, 0.65)}
    <!-- tabela (boş) -->
    ${shadow(930, 1010, 90, 16, 0.35, 'blurM')}
    ${rect(920, 900, 14, 110, '#6A5039')}
    ${rrect(840, 850, 174, 96, 10, '#FFFFFF', 'stroke="#0E4D45" stroke-width="6"')}
    ${rect(866, 876, 122, 14, brand.primary, 'rx="5"')}${rect(866, 904, 82, 12, brand.accent, 'rx="5"')}`,

  field: () => `
    ${sky('#9FC4DB', '#D5E6EE', '#F8EBD5')}
    ${ellipse(1500, 300, 260, 260, 'url(#sun)')}
    ${clouds(170)}
    <path d="M0 600 Q 380 520 760 590 T 1500 560 T 1920 580 L 1920 760 L 0 760 Z" fill="#9FB3AE" opacity="0.7"/>
    <path d="M0 660 Q 500 610 1000 650 T 1920 640 L 1920 1280 L 0 1280 Z" fill="#9BB57F"/>
    <!-- uzak çiftlik evi -->
    ${rect(1320, 590, 120, 70, '#EFE3D0')}<path d="M 1305 594 L 1380 548 L 1455 594 Z" fill="#9C5B3B"/>${rect(1370, 620, 26, 40, '#5B4A3A')}
    ${tree(1510, 670, 0.35)}${tree(1240, 675, 0.3)}
    <!-- ekin sıraları (perspektif) -->
    <defs>${lin('crop', [[0, '#C9B46A'], [1, '#A99345']])}</defs>
    <path d="M 0 700 L 1920 680 L 1920 1280 L 0 1280 Z" fill="url(#crop)"/>
    ${Array.from({ length: 34 }, (_, i) => {
      const x = -900 + i * 110;
      return `<path d="M ${960 + (x - 960) * 0.18} 690 L ${x} 1280" stroke="${i % 2 ? '#8E7A36' : '#B8A35A'}" stroke-width="${i % 2 ? 9 : 5}" opacity="0.8"/>`;
    }).join('')}
    ${rect(0, 686, W, 24, '#8FA36B', 'opacity="0.8"')}
    <!-- traktör izi / yol -->
    <path d="M 1500 1280 Q 1250 950 1010 700" stroke="#D9C79A" stroke-width="46" fill="none" opacity="0.85"/>
    ${cypress(120, 700, 0.7)}${cypress(180, 705, 0.55)}`,

  shop: () => `
    ${sky('#B8D4E2', '#DCE9EE', '#F5EEE4')}
    ${clouds(150)}
    <defs>${lin('bld', [[0, '#EADFCF'], [1, '#D3C2A9']])}${lin('sidewalk', [[0, '#E3DCCF'], [1, '#CFC6B6']])}${lin('roadS', [[0, '#7A7F80'], [1, '#5F6566']])}</defs>
    ${rect(120, 170, 1680, 830, 'url(#bld)')}
    ${rect(100, 150, 1720, 32, '#B79F82', 'rx="6"')}
    ${facadeWindows(200, 230, 7, 2, 150, 104, 72, 44, [2, 9, 12])}
    <!-- tabela alanı -->
    ${rect(120, 540, 1680, 90, brand.primary)}
    ${rrect(660, 562, 600, 46, 8, '#F7F5F0', 'opacity="0.92"')}
    <!-- tente -->
    ${Array.from({ length: 21 }, (_, i) => `<path d="M ${120 + i * 80} 630 h 80 l -10 64 h -60 z" fill="${i % 2 ? '#F7F5F0' : brand.accent}"/>`).join('')}
    ${rect(120, 690, 1680, 18, '#000000', 'opacity="0.12" filter="url(#blurS)"')}
    <!-- vitrin + raflar -->
    ${rect(200, 720, 1060, 280, '#3E4A48')}
    <defs>${lin('vitrin', [[0, '#CFE1E7'], [1, '#A9C4CD']])}</defs>
    ${rect(214, 734, 1032, 266, 'url(#vitrin)')}
    ${Array.from({ length: 3 }, (_, r) => `${rect(240, 790 + r * 70, 980, 8, '#8E7760')}${Array.from({ length: 12 }, (_, c) => rrect(260 + c * 80, 752 + r * 70, 50, 38, 4, ['#B5813A', '#0E4D45', '#E07A5F', '#F3EEE6'][(r + c) % 4])).join('')}`).join('')}
    <path d="M 214 980 L 700 734 L 820 734 L 330 1000 Z" fill="#FFFFFF" opacity="0.22"/>
    ${rect(1340, 720, 360, 280, '#5B4A3A')}${rect(1362, 742, 150, 258, 'url(#vitrin)')}${rect(1530, 742, 150, 258, 'url(#vitrin)')}
    ${rect(0, 1000, W, 80, 'url(#sidewalk)')}
    ${rect(0, 1076, W, 204, 'url(#roadS)')}
    ${Array.from({ length: 12 }, (_, i) => rect(40 + i * 170, 1170, 90, 10, '#EDE7DC', 'rx="5"')).join('')}
    ${plantPot(1290, 1000, 0.6)}${plantPot(160, 1000, 0.6)}`,

  office: () => `
    <defs>${lin('wallO', [[0, '#EFF2F1'], [1, '#E0E5E3']])}${lin('floorO', [[0, '#A4ACAA'], [1, '#858F8D']])}</defs>
    ${rect(0, 0, W, 900, 'url(#wallO)')}
    ${rect(0, 900, W, 380, 'url(#floorO)')}
    <!-- cam cephe + şehir -->
    <defs>${lin('cityO', [[0, '#BFD8E4'], [1, '#E7F0F2']])}</defs>
    ${rect(90, 110, 1740, 620, '#FFFFFF')}
    ${rect(106, 126, 1708, 588, 'url(#cityO)')}
    <g opacity="0.8">${Array.from({ length: 11 }, (_, i) => rect(130 + i * 158, 380 - ((i * 53) % 170), 120, 334 + ((i * 53) % 170), i % 2 ? '#A9C3CC' : '#B7CCD3')).join('')}</g>
    ${[1, 2, 3, 4].map((i) => rect(90 + i * 348, 110, 14, 620, '#FFFFFF')).join('')}
    <path d="M 120 700 L 700 130 L 860 130 L 280 700 Z" fill="#FFFFFF" opacity="0.2"/>
    <!-- masa -->
    ${shadow(960, 1060, 640, 50, 0.4)}
    <defs>${lin('desk', [[0, '#8A6644'], [1, '#6E5036']])}</defs>
    ${rrect(320, 800, 1280, 44, 12, 'url(#desk)')}
    ${rect(360, 844, 22, 190, '#2E3A38')}${rect(1538, 844, 22, 190, '#2E3A38')}
    ${[560, 1020].map((x) => `${rrect(x, 640, 300, 170, 10, '#232829')}${rect(x + 14, 654, 272, 142, '#2F5D57')}${rect(x + 140, 810, 20, 8, '#232829')}`).join('')}
    ${[700, 1160].map((x) => `${shadow(x, 1190, 110, 18, 0.35, 'blurM')}${rrect(x - 90, 900, 180, 200, 40, brand.primary)}${rect(x - 8, 1100, 16, 80, '#2E3A38')}`).join('')}
    ${plantPot(1760, 1040, 0.9)}${plantPot(170, 1040, 0.8)}`,

  'duplex-facade': () => `
    ${sky('#A9CCE0', '#D8E7EE', '#F6ECDD')}
    ${ellipse(1600, 230, 240, 240, 'url(#sun)')}
    ${clouds(190)}
    ${shadow(960, 1070, 700, 60, 0.35)}
    <defs>${lin('roof', [[0, '#9C5F40'], [1, '#7A4630']])}${lin('wallD', [[0, '#F5ECE0'], [1, '#E0D0B9']])}</defs>
    <path d="M 440 420 L 960 170 L 1480 420 Z" fill="url(#roof)"/>
    ${rect(430, 410, 1060, 22, '#6A3D2A', 'rx="6"')}
    ${rect(490, 430, 940, 640, 'url(#wallD)')}
    ${rect(490, 720, 940, 22, '#C9B79C')}
    ${facadeWindows(560, 480, 4, 1, 150, 160, 70, 0, [1], true)}
    ${facadeWindows(560, 790, 2, 1, 150, 170, 70, 0, [0])}
    ${rect(1060, 800, 180, 270, '#5B4A3A', 'rx="4"')}${circle(1210, 940, 9, brand.accent)}
    ${rect(1030, 776, 240, 26, '#3F4A48', 'rx="6"')}
    <defs>${lin('grassD', [[0, '#8FB07F'], [1, '#6F9064']])}</defs>
    ${rect(0, 1060, W, 220, 'url(#grassD)')}
    <path d="M 1150 1070 L 1100 1280 L 1260 1280 L 1250 1070 Z" fill="#E7DCC8"/>
    ${tree(250, 1080, 1.1)}${tree(1700, 1080, 1.15)}${cypress(420, 1075, 0.75)}`,

  'house-garden': () => `
    ${sky('#ABCDE0', '#D9E8EE', '#F7EDDE')}
    ${ellipse(360, 240, 240, 240, 'url(#sun)')}
    ${clouds(180)}
    <defs>${lin('grassH', [[0, '#92B381'], [1, '#6B8E60']])}${lin('roofH', [[0, '#A0603F'], [1, '#7A4630']])}${lin('wallH', [[0, '#F4E9D8'], [1, '#DECDB3']])}</defs>
    ${rect(0, 880, W, 400, 'url(#grassH)')}
    ${shadow(1000, 900, 440, 40, 0.35)}
    <path d="M 560 520 L 1000 280 L 1440 520 Z" fill="url(#roofH)"/>
    ${rect(610, 510, 780, 390, 'url(#wallH)')}
    ${facadeWindows(680, 580, 3, 1, 140, 130, 90, 0, [2])}
    ${rect(930, 740, 140, 160, '#5B4A3A', 'rx="4"')}
    ${rect(1180, 260, 60, 150, '#8E5B3F')}
    <!-- yol ve çiçekler -->
    <path d="M 930 900 Q 880 1060 700 1280 L 980 1280 Q 1080 1060 1070 900 Z" fill="#E9E0CF"/>
    ${Array.from({ length: 16 }, (_, i) => circle(620 + i * 44, 930 + (i % 2) * 12, 13, ['#E07A5F', '#F2C14E', '#F7F5F0'][i % 3])).join('')}
    <!-- çit -->
    ${rect(0, 1050, W, 14, '#F4F0E8')}
    ${Array.from({ length: 48 }, (_, i) => rrect(i * 40, 1000, 12, 90, 5, '#FFFFFF')).join('')}
    ${tree(250, 900, 1.2)}${tree(1700, 900, 1.25)}${tree(440, 910, 0.7)}`,

  'balcony-view': () => `
    ${sky('#9DC0D8', '#E9D8C6', '#F6D9B8')}
    ${ellipse(1420, 470, 300, 300, 'url(#sun)')}
    <g opacity="0.55">${Array.from({ length: 14 }, (_, i) => rect(i * 140, 560 - ((i * 37) % 160), 110, 400 + ((i * 37) % 160), '#9DB0BA')).join('')}</g>
    <g opacity="0.8">${Array.from({ length: 10 }, (_, i) => rect(40 + i * 190, 650 - ((i * 53) % 120), 140, 300 + ((i * 53) % 120), '#B7C6CC')).join('')}</g>
    <defs>${lin('floorBal', [[0, '#D9CAB4'], [1, '#C2AF94']])}</defs>
    ${rect(0, 940, W, 340, 'url(#floorBal)')}
    <!-- cam korkuluk -->
    ${rect(0, 800, W, 150, '#DDEBEF', 'opacity="0.45"')}
    ${rect(0, 790, W, 16, '#FFFFFF')}
    ${Array.from({ length: 9 }, (_, i) => rect(i * 240, 790, 10, 160, '#FFFFFF')).join('')}
    <!-- oturma grubu -->
    ${shadow(1280, 1150, 300, 36, 0.35)}
    ${rrect(1080, 1000, 400, 30, 14, '#6A5039')}${rect(1110, 1030, 14, 110, '#4F3B2A')}${rect(1436, 1030, 14, 110, '#4F3B2A')}
    ${circle(1200, 982, 22, '#F3EEE6')}${rect(1300, 950, 40, 50, '#B5813A', 'rx="6"')}
    ${shadow(760, 1180, 180, 30, 0.35)}
    ${rrect(640, 960, 240, 60, 24, brand.primary)}${rrect(650, 860, 220, 120, 30, '#16655A')}
    ${plantPot(320, 1130, 1.0)}`,

  villa: () => `
    ${sky('#8FC0DC', '#CFE5EE', '#F8EBD6')}
    ${ellipse(420, 230, 260, 260, 'url(#sun)')}
    ${clouds(160)}
    <path d="M0 560 Q 380 470 760 540 T 1500 500 T 1920 520 L 1920 720 L 0 720 Z" fill="#A6BDB3" opacity="0.7"/>
    <defs>${lin('villaW', [[0, '#FBF7F0'], [1, '#E7DDCD']])}${lin('villaG', [[0, '#9CC0CE'], [1, '#C9DDE4']])}${lin('stone', [[0, '#CDB89A'], [1, '#B09A7A']])}${lin('pool', [[0, '#5FB3C7'], [1, '#2E8CA6']])}</defs>
    ${shadow(980, 900, 820, 50, 0.35)}
    <!-- alt kat -->
    ${rect(260, 560, 1400, 340, 'url(#villaW)')}
    ${rect(300, 600, 820, 260, 'url(#villaG)')}
    ${[1, 2, 3].map((i) => rect(300 + i * 205, 600, 10, 260, '#FFFFFF')).join('')}
    <path d="M 300 840 L 620 600 L 700 600 L 380 860 Z" fill="#FFFFFF" opacity="0.25"/>
    ${rect(1160, 560, 500, 340, 'url(#stone)')}
    ${Array.from({ length: 6 }, (_, r) => rect(1160, 590 + r * 52, 500, 3, '#9C8666', 'opacity="0.6"')).join('')}
    <!-- üst kat (konsol) -->
    ${rect(520, 330, 1000, 230, 'url(#villaW)')}
    ${rect(480, 310, 1080, 26, '#3E4A48', 'rx="4"')}
    ${rect(230, 540, 1460, 24, '#3E4A48', 'rx="4"')}
    ${rect(580, 370, 600, 160, 'url(#villaG)')}
    ${[1, 2].map((i) => rect(580 + i * 200, 370, 10, 160, '#FFFFFF')).join('')}
    ${rect(560, 520, 640, 10, '#FFFFFF')}
    <!-- teras + havuz -->
    <defs>${lin('deck', [[0, '#C9A77F'], [1, '#A7825C']])}</defs>
    ${rect(0, 900, W, 380, 'url(#deck)')}
    ${Array.from({ length: 14 }, (_, i) => rect(0, 915 + i * 26, W, 2, '#8F6D4A', 'opacity="0.35"')).join('')}
    ${rrect(300, 980, 1200, 230, 10, '#F4F0E8')}
    ${rect(320, 996, 1160, 198, 'url(#pool)')}
    ${Array.from({ length: 6 }, (_, i) => `<path d="M ${360 + i * 190} ${1040 + (i % 2) * 40} q 40 -14 80 0 t 80 0" stroke="#BFE6EF" stroke-width="5" fill="none" opacity="0.7"/>`).join('')}
    <!-- şezlonglar -->
    ${[1580, 1760].map((x) => `${shadow(x, 1220, 90, 14, 0.3, 'blurM')}<path d="M ${x - 80} 1200 L ${x + 60} 1200 L ${x + 90} 1140 L ${x + 70} 1135 L ${x + 45} 1180 L ${x - 80} 1180 Z" fill="#FFFFFF"/>`).join('')}
    ${tree(130, 900, 1.05, 'olive')}${cypress(1760, 900, 1.0)}${cypress(1850, 905, 0.8)}
    ${plantPot(1560, 900, 0.7)}`,
};

function svgFor(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${commonDefs}${scenes[name]()}${finish()}</svg>`;
}

// ---------------------------------------------------------------------------
// Marka varlıkları
// ---------------------------------------------------------------------------
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${brand.primary}"/>
  <path d="M14 30 L32 16 L50 30" fill="none" stroke="${brand.accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M23 29 V48 H41 M23 38.5 H37 M23 29 H41" fill="none" stroke="${brand.cream}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${brand.primary}"/>
  <path d="M0 630 L 1200 380 L 1200 630 Z" fill="${brand.primaryDark}"/>
  <g transform="translate(96 150) scale(3)">${iconSvg.replace(/<\/?svg[^>]*>/g, '')}</g>
  <text x="96" y="430" font-family="DejaVu Serif, Georgia, serif" font-size="76" fill="${brand.cream}">Elvankent Gayrimenkul</text>
  <text x="98" y="490" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="#D8C49F" letter-spacing="2">Satılık ve kiralık konut, ticari gayrimenkul ve arsa</text>
</svg>`;

const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
  <rect width="1200" height="900" fill="#EEE9E1"/>
  <g fill="none" stroke="#B9AE9C" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" transform="translate(450 300)">
    <path d="M20 130 L150 30 L280 130"/><path d="M60 110 V270 H240 V110"/><path d="M125 270 V195 H175 V270"/>
  </g>
  <text x="600" y="690" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="40" fill="#8F8472">Fotoğraf hazırlanıyor</text>
</svg>`;

/** PNG verisini tek girişli ICO kabına sarar. */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

async function main() {
  const only = process.argv.slice(2);
  const names = only.length ? only.filter((n) => scenes[n]) : Object.keys(scenes);
  const demoDir = path.join(root, 'public', 'demo');
  await mkdir(demoDir, { recursive: true });

  // V1'in tek dosyalık demo görselleri (public/demo/{sahne}.webp) artık kullanılmıyor
  for (const entry of await readdir(demoDir)) {
    if (entry.endsWith('.webp')) await rm(path.join(demoDir, entry));
  }

  for (const name of names) {
    const dir = path.join(demoDir, name);
    await mkdir(dir, { recursive: true });
    const master = await sharp(Buffer.from(svgFor(name)), { density: 72 }).png().toBuffer();
    for (const width of WIDTHS) {
      await sharp(master)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: width <= 640 ? 76 : 82, effort: 5, smartSubsample: true })
        .toFile(path.join(dir, `w${width}.webp`));
    }
    console.info(`  ✓ ${name}`);
  }

  const appDir = path.join(root, 'src', 'app');
  await writeFile(path.join(appDir, 'icon.svg'), iconSvg);
  await sharp(Buffer.from(iconSvg)).resize(180, 180).png().toFile(path.join(appDir, 'apple-icon.png'));
  const favPng = await sharp(Buffer.from(iconSvg)).resize(48, 48).png().toBuffer();
  await writeFile(path.join(appDir, 'favicon.ico'), pngToIco(favPng, 48));

  await writeFile(path.join(root, 'public', 'placeholder-property.svg'), placeholderSvg);
  await sharp(Buffer.from(ogSvg)).png({ compressionLevel: 9 }).toFile(path.join(root, 'public', 'og-default.png'));
  console.info(`Üretildi: ${names.length} demo sahne × ${WIDTHS.length} varyant, yer tutucu, favicon seti, OG görseli.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
