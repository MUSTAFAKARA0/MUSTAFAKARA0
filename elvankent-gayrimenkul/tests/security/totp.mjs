import { createHmac } from 'node:crypto';

/** RFC 4648 base32 çözümü (TOTP sırları için) */
function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx < 0) throw new Error('Geçersiz base32 karakteri');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 TOTP (SHA-1, 30 sn, 6 hane) — yalnızca testlerde kod üretmek için */
export function totp(secret, time = Date.now(), step = 30) {
  const counter = Math.floor(time / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return { code, counter };
}

/**
 * Aynı zaman diliminde kullanılmış bir kodu tekrar üretmemek için gerekirse bir
 * sonraki 30 saniyelik dilimi bekler.
 */
export async function freshTotp(secret, lastCounter = -1) {
  let result = totp(secret);
  while (result.counter <= lastCounter) {
    await new Promise((r) => setTimeout(r, 1000));
    result = totp(secret);
  }
  return result;
}
