#!/usr/bin/env node
/**
 * KI-23 canlı denetim — SQL dosyası bekçisi (veritabanına bağlanmaz).
 *
 *   node scripts/ki23-denetim-guard.mjs supabase/ops/canli_sema_denetimi.sql
 *
 * Dosya canlıya gönderilmeden önce çalışır. Geçer (çıkış 0) ancak:
 *   - yorumlar ve tırnak içi metin çıkarıldıktan sonra TEK ifade var (tek ";", sonda),
 *   - ifade WITH … SELECT biçiminde (ilk sözcük "with", ana sorgu "select"),
 *   - yazma / DDL / yetki / oturum ayarı / dış bağlantı / dosya / süreç komutu YOK,
 *   - dolar tırnaklı gövde ($$ … $$) YOK (çalıştırılabilir kod gömülemez).
 * Aksi halde çıkış 2 ve yalnız kuralın adı yazılır (SQL metni yazılmaz).
 */
import { readFileSync } from 'node:fs';

const FORBIDDEN = [
  ['insert', /\binsert\b/i], ['update', /\bupdate\b/i], ['delete', /\bdelete\b/i], ['merge', /\bmerge\b/i],
  ['create', /\bcreate\b/i], ['alter', /\balter\b/i], ['drop', /\bdrop\b/i], ['truncate', /\btruncate\b/i],
  ['grant', /\bgrant\b/i], ['revoke', /\brevoke\b/i], ['comment on', /\bcomment\s+on\b/i], ['security label', /\bsecurity\s+label\b/i],
  ['set', /\bset\s+\w/i], ['reset', /\breset\b/i], ['copy', /\bcopy\b/i], ['call', /\bcall\b/i], ['do', /\bdo\b/i],
  ['execute', /\bexecute\b/i], ['prepare', /\bprepare\b/i], ['listen/notify', /\b(listen|notify|unlisten)\b/i],
  ['lock', /\block\b/i], ['vacuum/analyze/cluster/reindex', /\b(vacuum|analyze|cluster|reindex|refresh)\b/i],
  ['transaction', /\b(begin|commit|rollback|savepoint|start\s+transaction)\b/i],
  ['for update/share', /\bfor\s+(update|share|no\s+key|key)\b/i], ['into', /\binto\b/i],
  ['set_config', /set_config/i], ['dblink/fdw', /\b(dblink\w*|postgres_fdw)\b/i],
  ['file/process functions', /\b(pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|lo_\w+|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_sleep\w*|pg_advisory\w*|nextval|setval|txid_current|pg_current_xact_id|pg_notify)\b/i],
  ['psql meta command', /^\s*\\/m],
];

const file = process.argv[2];
if (!file) { console.error('✗ BEKÇİ: dosya verilmedi'); process.exit(2); }
let text;
try { text = readFileSync(file, 'utf8'); } catch { console.error('✗ BEKÇİ: dosya okunamadı'); process.exit(2); }

const fail = (rule) => { console.error(`✗ BEKÇİ: izin verilmeyen yapı (${rule}); hiçbir şey gönderilmedi`); process.exit(2); };
if (/\$[A-Za-z_0-9]*\$/.test(text)) fail('dolar tırnaklı gövde');
const noLineComments = text.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
if (/\/\*/.test(noLineComments) || /--/.test(noLineComments.replace(/'(?:[^']|'')*'/g, "''"))) fail('satır içi / blok yorum');
const skeleton = noLineComments.replace(/'(?:[^']|'')*'/g, "''").replace(/"(?:[^"]|"")*"/g, '""');
const semis = (skeleton.match(/;/g) ?? []).length;
if (semis !== 1 || !skeleton.trim().endsWith(';')) fail('tek ifade değil');
if (!/^with\b/i.test(skeleton.trim())) fail('WITH ile başlamıyor');
for (const [name, re] of FORBIDDEN) if (re.test(skeleton)) fail(name);
console.log('✓ BEKÇİ: tek salt okunur SELECT ifadesi');
