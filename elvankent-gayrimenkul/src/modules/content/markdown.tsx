import { Fragment, type ReactNode } from 'react';

/**
 * Güvenli Markdown alt kümesi → React öğeleri.
 *
 * HTML'e hiç izin verilmez (dangerouslySetInnerHTML kullanılmaz); tüm metin
 * React tarafından kaçışlanır. Bağlantılarda yalnızca http(s), mailto, tel ve
 * site içi (/ veya #) adreslere izin verilir → XSS yüzeyi yoktur.
 *
 * Desteklenen: ## / ### başlık, paragraf, **kalın**, *italik*, [bağlantı](url),
 * - / 1. listeler, > alıntı, | tablo |, --- ayırıcı.
 */

const SAFE_URL = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[2] !== undefined) {
      nodes.push(<strong key={key}>{match[2]}</strong>);
    } else if (match[3] !== undefined || match[4] !== undefined) {
      nodes.push(<em key={key}>{match[3] ?? match[4]}</em>);
    } else if (match[5] !== undefined && match[6] !== undefined) {
      const href = match[6];
      if (SAFE_URL.test(href)) {
        const external = /^https?:\/\//i.test(href);
        nodes.push(
          <a key={key} href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {match[5]}
          </a>,
        );
      } else {
        nodes.push(match[5]);
      }
    }
    last = pattern.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

type Block =
  | { type: 'h2' | 'h3' | 'p' | 'quote'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'hr' };

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) {
      i++;
      continue;
    }
    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: heading[1].length === 3 ? 'h3' : 'h2', text: heading[2] });
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(trimmed) || /^\d+[.)]\s+/.test(trimmed)) {
      const ordered = /^\d+[.)]\s+/.test(trimmed);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    if (trimmed.startsWith('>')) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        parts.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', text: parts.join(' ') });
      continue;
    }
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const header = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }
    const para: string[] = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|>|\||-{3,}$)/.test(lines[i].trim())) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', text: para.join(' ') });
  }
  return blocks;
}

/** {{anahtar}} yer tutucularını değiştirir (değerler düz metindir). */
export function fillPlaceholders(source: string, values: Record<string, string | null | undefined>): string {
  return source.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, key: string) => {
    const value = values[key];
    return value && value.trim() ? value : `[${key.toLocaleUpperCase('tr-TR').replace(/_/g, ' ')}]`;
  });
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className={className}>
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.type) {
          case 'h2':
            return <h2 key={key}>{renderInline(b.text, key)}</h2>;
          case 'h3':
            return <h3 key={key}>{renderInline(b.text, key)}</h3>;
          case 'quote':
            return <blockquote key={key}>{renderInline(b.text, key)}</blockquote>;
          case 'hr':
            return <hr key={key} />;
          case 'ul':
          case 'ol': {
            const List = b.type;
            return (
              <List key={key}>
                {b.items.map((item, j) => (
                  <li key={`${key}-${j}`}>{renderInline(item, `${key}-${j}`)}</li>
                ))}
              </List>
            );
          }
          case 'table':
            return (
              <div key={key} className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      {b.header.map((h, j) => (
                        <th key={j} scope="col">
                          {renderInline(h, `${key}-h${j}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>{renderInline(cell, `${key}-${r}-${c}`)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={key}>{renderInline(b.text, key)}</p>;
        }
      })}
    </div>
  );
}

/** Düz metin özet (meta açıklama, kart metni) */
export function markdownToPlainText(source: string, max = 200): string {
  const text = source
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/[*_]([^*_]+)[*_]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*>]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : text;
}

export function MarkdownFragment({ text }: { text: string }) {
  return <Fragment>{renderInline(text, 'f')}</Fragment>;
}
