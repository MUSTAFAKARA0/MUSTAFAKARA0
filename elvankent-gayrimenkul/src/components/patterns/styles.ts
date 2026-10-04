import type { InteractionPattern } from '@/theme-engine/ids';
import { INTERACTION_CSS } from '@/components/patterns/interaction/styles';

/**
 * Seçili desenlerin CSS'i: yalnızca manifestte seçilenler (kapalı liste; bilinmeyen kimlik
 * hiçbir şey üretmez, kullanıcı verisinden CSS üretilmez). Seçim yoksa boş metin döner ve
 * Site Renderer sayfaya stil etiketi bile yazmaz (Elvankent'in çıktısı değişmez).
 */
export function patternCss(selection: { interactions?: readonly InteractionPattern[] }): string {
  return (selection.interactions ?? []).map((id) => INTERACTION_CSS[id] ?? '').join('');
}
