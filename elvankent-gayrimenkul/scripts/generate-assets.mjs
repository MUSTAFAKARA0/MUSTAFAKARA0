#!/usr/bin/env node
/**
 * Statik marka ve demo görsellerini üretir:
 *  - public/demo/*.webp  → DEMO ilanlarda kullanılan illüstrasyonlar (gerçek mülk fotoğrafı değildir)
 *  - src/app/icon.svg, src/app/apple-icon.png, src/app/favicon.ico → favicon seti
 *  - public/og-default.png → paylaşım (Open Graph) varsayılan görseli
 *
 * Kullanım: node scripts/generate-assets.mjs
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const W = 1600;
const H = 1067;

const brand = { primary: '#0E4D45', primaryDark: '#0A3832', accent: '#C08A3E', cream: '#F7F5F0' };

const demoBadge = `
  <g transform="translate(${W - 300}, 40)">
    <rect width="260" height="64" rx="32" fill="#0A3832" fill-opacity="0.82"/>
    <text x="130" y="42" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="26" font-weight="700" letter-spacing="3" fill="#F7F5F0">DEMO GÖRSEL</text>
  </g>`;

const sky = (top, bottom) => `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>`;

function windows(x, y, cols, rows, w, h, gapX, gapY, color, lit = []) {
  let out = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const on = lit.includes(r * cols + c);
      out += `<rect x="${x + c * (w + gapX)}" y="${y + r * (h + gapY)}" width="${w}" height="${h}" rx="4" fill="${on ? '#F4D9A6' : color}"/>`;
    }
  }
  return out;
}

const scenes = {
  'apartment-facade': () => `
    ${sky('#CFE3EA', '#F3EEE4')}
    <circle cx="1300" cy="210" r="90" fill="#F6E3B8" opacity="0.8"/>
    <rect x="0" y="880" width="${W}" height="187" fill="#8FA88A"/>
    <rect x="230" y="250" width="520" height="650" fill="#E8DCCB"/>
    <rect x="230" y="230" width="520" height="30" fill="#BFA98C"/>
    ${windows(275, 290, 4, 6, 80, 70, 40, 34, '#6F8C94', [3, 9, 14])}
    <rect x="440" y="800" width="100" height="100" fill="#5B4A3A"/>
    <rect x="800" y="330" width="560" height="570" fill="#D9C7AF"/>
    <rect x="800" y="310" width="560" height="28" fill="#A88F72"/>
    ${windows(845, 370, 4, 5, 90, 72, 40, 30, '#6F8C94', [1, 6, 12, 17])}
    ${[0, 1, 2, 3, 4].map((i) => `<rect x="835" y="${446 + i * 102}" width="490" height="10" fill="#8E7760"/>`).join('')}
    <rect x="1030" y="800" width="100" height="100" fill="#5B4A3A"/>
    <g fill="#4F7A55">
      <circle cx="140" cy="820" r="80"/><circle cx="1460" cy="830" r="90"/><circle cx="780" cy="860" r="50"/>
    </g>
    <rect x="0" y="960" width="${W}" height="107" fill="#6B6F70"/>
    <rect x="0" y="1005" width="${W}" height="8" fill="#E9E4DA" stroke-dasharray="60 40"/>`,

  'living-room': () => `
    <rect width="${W}" height="${H}" fill="#EFE8DC"/>
    <rect x="0" y="780" width="${W}" height="287" fill="#B89B7A"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${i * 200}" y="780" width="4" height="287" fill="#A3876A"/>`).join('')}
    <rect x="980" y="140" width="460" height="520" fill="#CFE3EA" stroke="#FFFFFF" stroke-width="18"/>
    <rect x="1202" y="140" width="16" height="520" fill="#FFFFFF"/>
    <rect x="200" y="560" width="620" height="170" rx="28" fill="${brand.primary}"/>
    <rect x="220" y="470" width="580" height="130" rx="30" fill="#14655B"/>
    <rect x="180" y="540" width="70" height="200" rx="26" fill="#0B4039"/>
    <rect x="770" y="540" width="70" height="200" rx="26" fill="#0B4039"/>
    <rect x="300" y="500" width="120" height="80" rx="16" fill="${brand.accent}"/>
    <rect x="600" y="500" width="120" height="80" rx="16" fill="#E6D3B3"/>
    <ellipse cx="520" cy="880" rx="330" ry="60" fill="#E4D6C0"/>
    <rect x="400" y="790" width="240" height="24" rx="10" fill="#6A5039"/>
    <rect x="1280" y="700" width="18" height="90" fill="#6A5039"/>
    <circle cx="1289" cy="660" r="70" fill="#4F7A55"/>
    <rect x="360" y="230" width="300" height="190" fill="#FFFFFF" stroke="#C9B79C" stroke-width="10"/>
    <path d="M380 400 L470 300 L540 360 L600 310 L640 400 Z" fill="${brand.accent}" opacity="0.7"/>`,

  kitchen: () => `
    <rect width="${W}" height="${H}" fill="#F1ECE3"/>
    <rect x="0" y="860" width="${W}" height="207" fill="#CDBBA3"/>
    <rect x="120" y="180" width="1360" height="200" fill="#FFFFFF" stroke="#D8CDBC" stroke-width="6"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${140 + i * 225}" y="200" width="205" height="160" fill="#FAF7F2" stroke="#E0D6C6" stroke-width="3"/>`).join('')}
    <rect x="120" y="420" width="1360" height="150" fill="#E7E1D6"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => `<rect x="${130 + i * 112}" y="430" width="100" height="60" fill="#F7F3EC"/>`).join('')}
    <rect x="120" y="570" width="1360" height="30" fill="#3E4A48"/>
    <rect x="120" y="600" width="1360" height="260" fill="${brand.primary}"/>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${140 + i * 225}" y="620" width="205" height="220" rx="6" fill="#135C52"/><rect x="${225 + i * 225}" y="640" width="36" height="8" rx="4" fill="${brand.accent}"/>`).join('')}
    <rect x="600" y="520" width="200" height="50" fill="#2B2F31"/>
    <rect x="1040" y="500" width="30" height="70" fill="#9BA3A6"/>`,

  bedroom: () => `
    <rect width="${W}" height="${H}" fill="#E9EEF0"/>
    <rect x="0" y="800" width="${W}" height="267" fill="#BFA588"/>
    <rect x="1080" y="160" width="360" height="460" fill="#DCEAF0" stroke="#FFFFFF" stroke-width="16"/>
    <rect x="1080" y="160" width="120" height="460" fill="#E8DCCB" opacity="0.9"/>
    <rect x="300" y="380" width="620" height="220" rx="20" fill="#7C6450"/>
    <rect x="260" y="580" width="700" height="170" rx="24" fill="#FFFFFF"/>
    <rect x="260" y="640" width="700" height="110" rx="20" fill="#9FB7BE"/>
    <rect x="330" y="520" width="210" height="90" rx="30" fill="#F7F3EC"/>
    <rect x="680" y="520" width="210" height="90" rx="30" fill="#F7F3EC"/>
    <rect x="120" y="620" width="120" height="130" rx="10" fill="#8E7760"/>
    <circle cx="180" cy="570" r="40" fill="#F4D9A6"/>
    <rect x="175" y="580" width="10" height="45" fill="#6A5039"/>`,

  bathroom: () => `
    <rect width="${W}" height="${H}" fill="#EEF1F0"/>
    ${Array.from({ length: 10 }, (_, r) => Array.from({ length: 12 }, (_, c) => `<rect x="${c * 136}" y="${r * 110}" width="132" height="106" fill="${(r + c) % 2 ? '#E4E9E8' : '#F4F6F5'}"/>`).join('')).join('')}
    <rect x="0" y="860" width="${W}" height="207" fill="#8E9A98"/>
    <rect x="200" y="560" width="620" height="300" rx="40" fill="#FFFFFF" stroke="#D5DBDA" stroke-width="6"/>
    <rect x="1000" y="520" width="340" height="120" rx="10" fill="#FFFFFF"/>
    <rect x="1000" y="640" width="340" height="220" fill="${brand.primary}"/>
    <rect x="1060" y="240" width="220" height="250" rx="110" fill="#CFE3EA" stroke="#C0A57D" stroke-width="10"/>
    <rect x="1160" y="480" width="16" height="50" fill="#9BA3A6"/>
    <rect x="420" y="300" width="14" height="260" fill="#9BA3A6"/>
    <circle cx="427" cy="300" r="40" fill="#B7BFC1"/>`,

  land: () => `
    ${sky('#CDE0E8', '#F4EFE3')}
    <path d="M0 560 Q 300 470 620 540 T 1250 500 T ${W} 530 L ${W} ${H} L 0 ${H} Z" fill="#A9B98F"/>
    <path d="M0 650 Q 400 590 800 640 T ${W} 620 L ${W} ${H} L 0 ${H} Z" fill="#C9B784"/>
    <path d="M0 760 L ${W} 700 L ${W} ${H} L 0 ${H} Z" fill="#B59F6B"/>
    ${Array.from({ length: 14 }, (_, i) => `<path d="M ${-100 + i * 140} ${H} L ${400 + i * 90} 700" stroke="#A58F5E" stroke-width="6"/>`).join('')}
    <g fill="#5E7F55"><circle cx="220" cy="520" r="44"/><circle cx="290" cy="530" r="34"/><circle cx="1350" cy="490" r="50"/></g>
    <rect x="760" y="700" width="10" height="120" fill="#6A5039"/>
    <rect x="700" y="690" width="140" height="80" fill="#FFFFFF" stroke="${brand.primary}" stroke-width="6"/>
    <rect x="720" y="712" width="100" height="12" fill="${brand.primary}"/>
    <rect x="720" y="736" width="70" height="10" fill="${brand.accent}"/>`,

  shop: () => `
    ${sky('#D6E5EA', '#F2EEE6')}
    <rect x="0" y="900" width="${W}" height="167" fill="#8C8F8F"/>
    <rect x="160" y="200" width="1280" height="700" fill="#E3D6C3"/>
    ${windows(220, 240, 6, 2, 150, 100, 60, 40, '#7D98A0', [2, 7])}
    <rect x="160" y="520" width="1280" height="70" fill="${brand.primary}"/>
    <rect x="600" y="538" width="400" height="34" rx="6" fill="#F7F5F0" opacity="0.9"/>
    ${Array.from({ length: 16 }, (_, i) => `<path d="M ${160 + i * 80} 590 h 80 l -10 50 h -60 z" fill="${i % 2 ? '#F7F5F0' : brand.accent}"/>`).join('')}
    <rect x="220" y="660" width="760" height="240" fill="#BFD6DD" stroke="#5B4A3A" stroke-width="10"/>
    <rect x="1060" y="660" width="300" height="240" fill="#5B4A3A"/>
    <rect x="1080" y="680" width="120" height="220" fill="#BFD6DD"/>`,

  office: () => `
    <rect width="${W}" height="${H}" fill="#EDF0EF"/>
    <rect x="0" y="820" width="${W}" height="247" fill="#9AA3A1"/>
    <rect x="80" y="120" width="1440" height="520" fill="#CFE3EA" stroke="#FFFFFF" stroke-width="16"/>
    ${[1, 2, 3].map((i) => `<rect x="${80 + i * 360}" y="120" width="12" height="520" fill="#FFFFFF"/>`).join('')}
    <g fill="#A9C3CC">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${120 + i * 175}" y="${380 - (i % 3) * 60}" width="120" height="${260 + (i % 3) * 60}"/>`).join('')}</g>
    <rect x="300" y="640" width="1000" height="36" rx="8" fill="#6A5039"/>
    <rect x="340" y="676" width="20" height="150" fill="#3E4A48"/><rect x="1240" y="676" width="20" height="150" fill="#3E4A48"/>
    <rect x="480" y="560" width="200" height="120" rx="8" fill="#2B2F31"/><rect x="900" y="560" width="200" height="120" rx="8" fill="#2B2F31"/>
    <rect x="560" y="740" width="120" height="120" rx="20" fill="${brand.primary}"/><rect x="920" y="740" width="120" height="120" rx="20" fill="${brand.primary}"/>
    <circle cx="1440" cy="740" r="60" fill="#4F7A55"/><rect x="1430" y="780" width="20" height="60" fill="#6A5039"/>`,

  'duplex-facade': () => `
    ${sky('#C9DDE6', '#F5EFE5')}
    <rect x="0" y="880" width="${W}" height="187" fill="#8FA88A"/>
    <path d="M 380 360 L 800 150 L 1220 360 Z" fill="#8E5B3F"/>
    <rect x="420" y="360" width="760" height="540" fill="#F2E9DC"/>
    <rect x="420" y="600" width="760" height="18" fill="#C9B79C"/>
    ${windows(480, 410, 4, 1, 130, 140, 50, 0, '#6F8C94', [1])}
    ${windows(480, 660, 2, 1, 130, 150, 50, 0, '#6F8C94', [0])}
    <rect x="900" y="660" width="140" height="240" fill="#5B4A3A"/>
    <rect x="1000" y="770" width="12" height="12" rx="6" fill="${brand.accent}"/>
    <g fill="#4F7A55"><circle cx="260" cy="820" r="100"/><circle cx="1360" cy="810" r="110"/></g>
    <rect x="0" y="960" width="${W}" height="107" fill="#C7B9A3"/>`,

  'house-garden': () => `
    ${sky('#CFE2E9', '#F6F0E6')}
    <rect x="0" y="760" width="${W}" height="307" fill="#7FA070"/>
    <path d="M 480 430 L 820 230 L 1160 430 Z" fill="#9C5B3B"/>
    <rect x="530" y="430" width="580" height="360" fill="#EFE3D0"/>
    ${windows(580, 480, 3, 1, 120, 110, 60, 0, '#6F8C94', [2])}
    <rect x="770" y="640" width="110" height="150" fill="#5B4A3A"/>
    <path d="M 0 790 Q 400 740 800 800 T ${W} 780" stroke="#E9E0CF" stroke-width="40" fill="none"/>
    <g fill="#4F7A55"><circle cx="220" cy="640" r="120"/><circle cx="330" cy="700" r="80"/><circle cx="1380" cy="640" r="130"/></g>
    <g fill="#E07A5F">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${560 + i * 70}" cy="${830 + (i % 2) * 14}" r="12"/>`).join('')}</g>
    <rect x="0" y="880" width="${W}" height="16" fill="#E9E0CF"/>
    ${Array.from({ length: 40 }, (_, i) => `<rect x="${i * 40}" y="850" width="10" height="60" fill="#FFFFFF"/>`).join('')}`,

  'balcony-view': () => `
    ${sky('#BFD8E3', '#F7EBDD')}
    <g fill="#9DB3BC">${Array.from({ length: 12 }, (_, i) => `<rect x="${i * 140}" y="${520 - (i * 37) % 160}" width="110" height="${400 + (i * 37) % 160}"/>`).join('')}</g>
    <g fill="#B8CAD1">${Array.from({ length: 9 }, (_, i) => `<rect x="${60 + i * 180}" y="${620 - (i * 53) % 120}" width="130" height="${300 + (i * 53) % 120}"/>`).join('')}</g>
    <rect x="0" y="760" width="${W}" height="307" fill="#D7C9B4"/>
    <rect x="0" y="700" width="${W}" height="24" fill="#FFFFFF"/>
    ${Array.from({ length: 33 }, (_, i) => `<rect x="${i * 50}" y="724" width="10" height="130" fill="#FFFFFF"/>`).join('')}
    <rect x="0" y="850" width="${W}" height="20" fill="#FFFFFF"/>
    <rect x="1150" y="900" width="180" height="16" rx="8" fill="#6A5039"/>
    <circle cx="300" cy="920" r="60" fill="#4F7A55"/><rect x="270" y="940" width="60" height="80" fill="#B0643F"/>`,
};

function svgFor(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${scenes[name]()}${demoBadge}</svg>`;
}

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
  <text x="98" y="490" font-family="DejaVu Sans, Arial, sans-serif" font-size="30" fill="#D8C49F" letter-spacing="2">Satılık ve kiralık konut, iş yeri, arsa ilanları</text>
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
  const demoDir = path.join(root, 'public', 'demo');
  await mkdir(demoDir, { recursive: true });
  for (const name of Object.keys(scenes)) {
    await sharp(Buffer.from(svgFor(name))).webp({ quality: 80 }).toFile(path.join(demoDir, `${name}.webp`));
  }

  const appDir = path.join(root, 'src', 'app');
  await writeFile(path.join(appDir, 'icon.svg'), iconSvg);
  await sharp(Buffer.from(iconSvg)).resize(180, 180).png().toFile(path.join(appDir, 'apple-icon.png'));
  const favPng = await sharp(Buffer.from(iconSvg)).resize(48, 48).png().toBuffer();
  await writeFile(path.join(appDir, 'favicon.ico'), pngToIco(favPng, 48));

  await sharp(Buffer.from(ogSvg)).png({ compressionLevel: 9 }).toFile(path.join(root, 'public', 'og-default.png'));
  console.info(`Üretildi: ${Object.keys(scenes).length} demo görsel, favicon seti, OG görseli.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
