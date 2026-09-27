'use client';

import { useId, useRef, useState } from 'react';
import { Bold, Heading2, Heading3, Italic, Link2, List, ListOrdered, Minus, Quote } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/choice';
import { FieldError, Label } from '@/components/ui/form-controls';
import { fillPlaceholders, Markdown } from '@/modules/content/markdown';
import { cn } from '@/lib/utils';

type Format = 'h2' | 'h3' | 'bold' | 'italic' | 'ul' | 'ol' | 'quote' | 'link' | 'hr';

const TOOLS: { format: Format; label: string; icon: React.ComponentType<{ className?: string }>; shortcut?: string }[] = [
  { format: 'h2', label: 'Bölüm başlığı (H2)', icon: Heading2 },
  { format: 'h3', label: 'Alt başlık (H3)', icon: Heading3 },
  { format: 'bold', label: 'Kalın', icon: Bold, shortcut: 'Ctrl+B' },
  { format: 'italic', label: 'İtalik', icon: Italic, shortcut: 'Ctrl+I' },
  { format: 'ul', label: 'Madde listesi', icon: List },
  { format: 'ol', label: 'Numaralı liste', icon: ListOrdered },
  { format: 'quote', label: 'Alıntı', icon: Quote },
  { format: 'link', label: 'Bağlantı', icon: Link2, shortcut: 'Ctrl+K' },
  { format: 'hr', label: 'Ayırıcı çizgi', icon: Minus },
];

const LINE_PREFIX: Partial<Record<Format, string>> = { h2: '## ', h3: '### ', ul: '- ', quote: '> ' };

/** Seçili metne Markdown biçimi uygular; yeni metni ve seçimi döndürür */
function applyFormat(value: string, start: number, end: number, format: Format): { next: string; selStart: number; selEnd: number } {
  const selected = value.slice(start, end);
  if (format === 'bold' || format === 'italic') {
    const marker = format === 'bold' ? '**' : '*';
    const text = selected || (format === 'bold' ? 'kalın metin' : 'italik metin');
    const next = value.slice(0, start) + marker + text + marker + value.slice(end);
    return { next, selStart: start + marker.length, selEnd: start + marker.length + text.length };
  }
  if (format === 'link') {
    const text = selected || 'bağlantı metni';
    const url = 'https://';
    const next = `${value.slice(0, start)}[${text}](${url})${value.slice(end)}`;
    const urlStart = start + text.length + 3;
    return { next, selStart: urlStart, selEnd: urlStart + url.length };
  }
  if (format === 'hr') {
    const before = value.slice(0, start).replace(/\s*$/, '');
    const insert = `${before ? '\n\n' : ''}---\n\n`;
    const next = before + insert + value.slice(end).replace(/^\s*/, '');
    const pos = before.length + insert.length;
    return { next, selStart: pos, selEnd: pos };
  }
  // Satır bazlı biçimler: seçimi tam satırlara genişlet, zaten varsa kaldır
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEndIndex = value.indexOf('\n', end);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const prefixFor = (i: number) => (format === 'ol' ? `${i + 1}. ` : (LINE_PREFIX[format] ?? ''));
  const pattern = format === 'ol' ? /^\d+[.)]\s+/ : new RegExp(`^${(LINE_PREFIX[format] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  const allHave = lines.every((l) => pattern.test(l) || !l.trim());
  const replaced = lines
    .map((l, i) => {
      if (!l.trim()) return l;
      const stripped = l.replace(/^(#{1,3}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/, '');
      return allHave ? stripped : prefixFor(i) + stripped;
    })
    .join('\n');
  const next = value.slice(0, lineStart) + replaced + value.slice(lineEnd);
  return { next, selStart: lineStart, selEnd: lineStart + replaced.length };
}

export interface MarkdownEditorProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  rows?: number;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Önizlemede {{yer_tutucu}} alanlarını doldurmak için değerler */
  previewValues?: Record<string, string | null>;
  /** En az karakter (sayaçta gösterilir) */
  minLength?: number;
}

/**
 * Güvenli Markdown düzenleyici: araç çubuğu, klavye kısayolları ve sitedeki
 * görünümle aynı işleyiciyle önizleme. HTML yazılamaz (sitede gösterilmez).
 */
export function MarkdownEditor({ label, value, onChange, maxLength, rows = 16, error, hint, required, disabled, placeholder, previewValues, minLength }: MarkdownEditorProps) {
  const id = `md-${useId()}`;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  function format(kind: Format) {
    const el = ref.current;
    if (!el || disabled) return;
    const { next, selStart, selEnd } = applyFormat(value, el.selectionStart, el.selectionEnd, kind);
    if (next.length > maxLength) return;
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    const map: Record<string, Format> = { b: 'bold', i: 'italic', k: 'link' };
    if (map[key]) {
      e.preventDefault();
      format(map[key]);
    }
  }

  const length = value.length;
  const describedBy = [`${id}-hint`, error ? `${id}-error` : null].filter(Boolean).join(' ');

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
        <Label htmlFor={id} className="mb-0">
          {label}
          {required && (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          )}
        </Label>
        <SegmentedControl<'write' | 'preview'>
          label={`${label} görünümü`}
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'write', label: 'Yaz' },
            { value: 'preview', label: 'Önizleme' },
          ]}
        />
      </div>
      <div className={cn('overflow-hidden rounded-xl border bg-surface', error ? 'border-danger' : 'border-border-strong', 'focus-within:ring-2 focus-within:ring-ring/30')}>
        {mode === 'write' ? (
          <>
            <div role="toolbar" aria-label="Biçimlendirme" aria-controls={id} className="flex flex-wrap gap-0.5 border-b border-border bg-surface-muted/60 px-1.5 py-1">
              {TOOLS.map(({ format: f, label: toolLabel, icon: Icon, shortcut }) => (
                <button
                  key={f}
                  type="button"
                  disabled={disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => format(f)}
                  title={shortcut ? `${toolLabel} (${shortcut})` : toolLabel}
                  aria-label={toolLabel}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-foreground/75 transition hover:bg-surface hover:text-foreground disabled:opacity-40"
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              ))}
            </div>
            <textarea
              ref={ref}
              id={id}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              rows={rows}
              maxLength={maxLength}
              disabled={disabled}
              placeholder={placeholder}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              spellCheck
              lang="tr"
              className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-[13.5px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </>
        ) : (
          <div className="max-h-[70vh] min-h-48 overflow-y-auto px-5 py-4">
            {value.trim() ? (
              <Markdown source={previewValues ? fillPlaceholders(value, previewValues) : value} className="prose-content" />
            ) : (
              <p className="text-sm text-muted-foreground">Önizlenecek içerik yok.</p>
            )}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-[12.5px] text-muted-foreground">
        <span id={`${id}-hint`}>{hint ?? '## başlık · **kalın** · *italik* · - liste · [metin](adres)'}</span>
        <span className={cn('numeric shrink-0', minLength && length < minLength && 'font-semibold text-warning')}>
          {length.toLocaleString('tr-TR')}
          {minLength && length < minLength ? ` / en az ${minLength}` : ` / ${maxLength.toLocaleString('tr-TR')}`}
        </span>
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
