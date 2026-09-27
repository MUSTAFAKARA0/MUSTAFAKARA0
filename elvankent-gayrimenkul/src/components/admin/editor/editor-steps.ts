/** İlan sihirbazı adımları (sunucu ve istemci ortak kullanır; 'use client' dosyasında tutulmaz) */
export const EDITOR_STEPS = [
  { id: 'temel', label: 'Temel bilgiler' },
  { id: 'konum', label: 'Konum' },
  { id: 'ozellikler', label: 'Özellikler' },
  { id: 'fotograflar', label: 'Fotoğraflar' },
  { id: 'aciklama', label: 'Açıklama' },
  { id: 'seo', label: 'SEO' },
  { id: 'yayin', label: 'Yayınlama' },
] as const;

export type EditorStepId = (typeof EDITOR_STEPS)[number]['id'];

export function parseEditorStep(value: string | undefined): EditorStepId {
  return (EDITOR_STEPS.some((s) => s.id === value) ? value : 'temel') as EditorStepId;
}
