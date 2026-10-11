/**
 * CSV üretimi. Türkçe Excel uyumu için UTF-8 BOM ve noktalı virgül ayırıcı
 * kullanılır. Formül enjeksiyonuna karşı =, +, -, @ ile başlayan hücreler
 * metin olarak işaretlenir (OWASP CSV Injection önerisi).
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map((c) => csvCell(c.label)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c.key])).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}
