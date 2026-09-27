#!/usr/bin/env node
/**
 * Veritabanı şemasından TypeScript tiplerini üretir (Supabase CLI
 * `supabase gen types typescript` çıktısıyla aynı biçim).
 *
 * Kullanım:
 *   DATABASE_URL=postgresql://postgres:SIFRE@HOST:5432/postgres npm run db:types
 *
 * Supabase CLI kullanıyorsanız alternatif olarak:
 *   npx supabase gen types typescript --project-id PROJE_KODU --schema public > src/types/supabase.ts
 *
 * Gereksinim: `psql` komut satırı istemcisi.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL tanımlı değil.');
  process.exit(1);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outFile = path.join(root, 'src', 'types', 'supabase.ts');

function query(sql) {
  const out = execFileSync('psql', [dbUrl, '-X', '-At', '-c', sql], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out.trim() || 'null') ?? [];
}

const enums = query(`
  select json_agg(json_build_object('name', t.typname, 'values', (
    select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid)) order by t.typname)
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
   where n.nspname = 'public' and t.typtype = 'e';
`);

const columns = query(`
  select json_agg(json_build_object(
    'table', c.relname, 'kind', c.relkind, 'name', a.attname, 'num', a.attnum,
    'type', case when t.typcategory = 'A' then et.typname else t.typname end,
    'typtype', case when t.typcategory = 'A' then et.typtype else t.typtype end,
    'isArray', t.typcategory = 'A',
    'nullable', not a.attnotnull,
    'hasDefault', a.atthasdef,
    'identity', a.attidentity,
    'generated', a.attgenerated
  ) order by c.relname, a.attnum)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    join pg_type t on t.oid = a.atttypid
    left join pg_type et on et.oid = t.typelem
   where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm');
`);

const fks = query(`
  select json_agg(json_build_object(
    'name', con.conname,
    'table', src.relname,
    'columns', (select json_agg(a.attname order by k.ord) from unnest(con.conkey) with ordinality k(attnum, ord)
                  join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum),
    'refTable', ref.relname,
    'refColumns', (select json_agg(a.attname order by k.ord) from unnest(con.confkey) with ordinality k(attnum, ord)
                  join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum),
    'oneToOne', exists (
      select 1 from pg_index i
       where i.indrelid = con.conrelid and i.indisunique and i.indpred is null
         and (select array_agg(x order by x) from unnest(i.indkey::int2[]) x) = (select array_agg(x order by x) from unnest(con.conkey) x)
    )
  ) order by src.relname, con.conname)
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_namespace n on n.oid = src.relnamespace
    join pg_class ref on ref.oid = con.confrelid
    join pg_namespace rn on rn.oid = ref.relnamespace
   where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public';
`);

const functions = query(`
  select json_agg(json_build_object(
    'name', p.proname,
    'retset', p.proretset,
    'rettype', rt.typname,
    'rettyptype', rt.typtype,
    'retIsArray', rt.typcategory = 'A',
    'retElem', ret_el.typname,
    'nargs', p.pronargs,
    'ndefaults', p.pronargdefaults,
    'args', (
      select json_agg(json_build_object(
        'name', coalesce(p.proargnames[k.ord], ''),
        'mode', coalesce(p.proargmodes[k.ord], 'i'),
        'type', case when at.typcategory = 'A' then aet.typname else at.typname end,
        'typtype', case when at.typcategory = 'A' then aet.typtype else at.typtype end,
        'isArray', at.typcategory = 'A'
      ) order by k.ord)
        from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality k(typ, ord)
        join pg_type at on at.oid = k.typ
        left join pg_type aet on aet.oid = at.typelem
    )
  ) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_type rt on rt.oid = p.prorettype
    left join pg_type ret_el on ret_el.oid = rt.typelem
   where n.nspname = 'public' and rt.typname <> 'trigger' and p.prokind = 'f';
`);

const enumNames = new Set(enums.map((e) => e.name));

function tsType(pgType, typtype, isArray) {
  let base;
  if (typtype === 'e' && enumNames.has(pgType)) base = `Database["public"]["Enums"]["${pgType}"]`;
  else if (['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'oid'].includes(pgType)) base = 'number';
  else if (pgType === 'bool') base = 'boolean';
  else if (['json', 'jsonb'].includes(pgType)) base = 'Json';
  else if (['text', 'varchar', 'bpchar', 'uuid', 'date', 'time', 'timetz', 'timestamp', 'timestamptz',
    'interval', 'inet', 'citext', 'bytea', 'name', 'regprocedure'].includes(pgType)) base = 'string';
  else if (pgType === 'void') base = 'undefined';
  else base = 'unknown';
  return isArray ? `${base}[]` : base;
}

const tables = new Map();
for (const col of columns) {
  if (!tables.has(col.table)) tables.set(col.table, { kind: col.kind, columns: [] });
  tables.get(col.table).columns.push(col);
}

const ind = (n) => '  '.repeat(n);
let out = `// Bu dosya otomatik üretilir: npm run db:types — elle düzenlemeyin.\n\n`;
out += `export type Json =\n  | string\n  | number\n  | boolean\n  | null\n  | { [key: string]: Json | undefined }\n  | Json[]\n\n`;
out += `export type Database = {\n${ind(1)}public: {\n`;

function renderTable(name, table, isView) {
  let s = `${ind(3)}${name}: {\n`;
  s += `${ind(4)}Row: {\n`;
  for (const c of table.columns) {
    s += `${ind(5)}${c.name}: ${tsType(c.type, c.typtype, c.isArray)}${c.nullable ? ' | null' : ''}\n`;
  }
  s += `${ind(4)}}\n`;
  if (!isView) {
    for (const mode of ['Insert', 'Update']) {
      s += `${ind(4)}${mode}: {\n`;
      for (const c of table.columns) {
        const readOnly = c.identity === 'a' || c.generated === 's';
        if (readOnly) {
          s += `${ind(5)}${c.name}?: never\n`;
          continue;
        }
        const optional = mode === 'Update' || c.nullable || c.hasDefault || c.identity === 'd';
        s += `${ind(5)}${c.name}${optional ? '?' : ''}: ${tsType(c.type, c.typtype, c.isArray)}${c.nullable ? ' | null' : ''}\n`;
      }
      s += `${ind(4)}}\n`;
    }
  }
  const rels = fks.filter((f) => f.table === name);
  if (rels.length === 0) {
    s += `${ind(4)}Relationships: []\n`;
  } else {
    s += `${ind(4)}Relationships: [\n`;
    for (const f of rels) {
      s += `${ind(5)}{\n`;
      s += `${ind(6)}foreignKeyName: "${f.name}"\n`;
      s += `${ind(6)}columns: [${f.columns.map((c) => `"${c}"`).join(', ')}]\n`;
      s += `${ind(6)}isOneToOne: ${f.oneToOne}\n`;
      s += `${ind(6)}referencedRelation: "${f.refTable}"\n`;
      s += `${ind(6)}referencedColumns: [${f.refColumns.map((c) => `"${c}"`).join(', ')}]\n`;
      s += `${ind(5)}},\n`;
    }
    s += `${ind(4)}]\n`;
  }
  s += `${ind(3)}}\n`;
  return s;
}

out += `${ind(2)}Tables: {\n`;
for (const [name, table] of tables) if (['r', 'p'].includes(table.kind)) out += renderTable(name, table, false);
out += `${ind(2)}}\n`;

const views = [...tables].filter(([, t]) => ['v', 'm'].includes(t.kind));
out += `${ind(2)}Views: ${views.length ? '{\n' + views.map(([n, t]) => renderTable(n, t, true)).join('') + ind(2) + '}' : '{\n' + ind(3) + '[_ in never]: never\n' + ind(2) + '}'}\n`;

out += `${ind(2)}Functions: {\n`;
const seen = new Set();
for (const fn of functions) {
  if (seen.has(fn.name)) continue; // aşırı yükleme yok; ilk tanım kullanılır
  seen.add(fn.name);
  const args = fn.args ?? [];
  const inArgs = args.filter((a) => a.mode === 'i' || a.mode === 'b');
  const outCols = args.filter((a) => a.mode === 't' || a.mode === 'o');
  const firstDefault = inArgs.length - fn.ndefaults;
  out += `${ind(3)}${fn.name}: {\n`;
  if (inArgs.length === 0) {
    out += `${ind(4)}Args: never\n`;
  } else {
    out += `${ind(4)}Args: {\n`;
    inArgs.forEach((a, i) => {
      out += `${ind(5)}${a.name}${i >= firstDefault ? '?' : ''}: ${tsType(a.type, a.typtype, a.isArray)}\n`;
    });
    out += `${ind(4)}}\n`;
  }
  let ret;
  if (outCols.length > 0) {
    ret = `{\n${outCols.map((c) => `${ind(5)}${c.name}: ${tsType(c.type, c.typtype, c.isArray)}`).join('\n')}\n${ind(4)}}[]`;
  } else if (fn.rettype === 'record') {
    ret = 'Json';
  } else {
    const t = fn.retIsArray ? tsType(fn.retElem, 'b', true) : tsType(fn.rettype, fn.rettyptype, false);
    ret = fn.retset ? `${t}[]` : t;
  }
  out += `${ind(4)}Returns: ${ret}\n`;
  out += `${ind(3)}}\n`;
}
out += `${ind(2)}}\n`;

out += `${ind(2)}Enums: {\n`;
for (const e of enums) out += `${ind(3)}${e.name}: ${e.values.map((v) => `"${v}"`).join(' | ')}\n`;
out += `${ind(2)}}\n`;
out += `${ind(2)}CompositeTypes: {\n${ind(3)}[_ in never]: never\n${ind(2)}}\n`;
out += `${ind(1)}}\n}\n\n`;

out += `type PublicSchema = Database["public"]\n\n`;
out += `export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]\n`;
out += `export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]\n`;
out += `export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]\n`;
out += `export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]\n`;
out += `export type FunctionReturns<T extends keyof PublicSchema["Functions"]> = PublicSchema["Functions"][T]["Returns"]\n`;

writeFileSync(outFile, out);
console.info(`✓ ${path.relative(root, outFile)} üretildi: ${tables.size} tablo/görünüm, ${seen.size} fonksiyon, ${enums.length} enum.`);
