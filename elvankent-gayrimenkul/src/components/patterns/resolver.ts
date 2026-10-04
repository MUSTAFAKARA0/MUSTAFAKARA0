import 'server-only';
import type { PatternDataNeed, PatternMeta } from '@/components/patterns/contracts';
import { findPattern, PATTERN_REGISTRY } from '@/components/patterns/registry';
import { SITE_SURFACES, surfaceContract, type SiteSurface } from '@/components/patterns/surfaces';
import type { SiteView } from '@/site-config/load';

/**
 * DESEN ÇÖZÜMLEYİCİ (yalnızca sunucu): MANIFEST → AİLE → YÜZEY → DESEN.
 *
 * Aile kararları derleme sırasında manifeste yazılır (Site Factory › compileManifest: manifest
 * varyantı > ailenin kararı); çalışma zamanında çözümleyici yalnızca sitenin yapılandırmasını
 * okur ve yüzey için KAYITLI bir desen döndürür. Seçim yoksa, bilinmiyorsa veya henüz
 * uygulanmamışsa (planned) yüzeyin mevcut standart bileşeni döner: eski kiracı → eski manifest
 * → eski görünüm.
 *
 * Sınırlar: ilan/CRM/Supabase sorgusu, kimlik doğrulama veya yetki YOK — girdi yalnızca SiteView
 * verisidir. 'server-only': tarayıcı paketine giremez (istemci bileşeni içe aktaramaz).
 */
export type PatternView = Pick<SiteView, 'config' | 'style'>;

/** Yüzeyin manifestteki ham seçimi (yoksa null) */
export function selectedPatternId(view: PatternView | null | undefined, surface: SiteSurface): string | null {
  if (!view) return null;
  const { setting } = surfaceContract(surface);
  const value = setting.in === 'style' ? view.style[setting.key] : view.config.style.slots?.[setting.key];
  return typeof value === 'string' ? value : null;
}

/** Yüzeyi çizecek desen (her zaman kayıtlı bir desen; bulunamazsa standart/tema varsayılanı) */
export function resolvePattern(view: PatternView | null | undefined, surface: SiteSurface): PatternMeta {
  const { kind, setting } = surfaceContract(surface);
  const selected = selectedPatternId(view, surface);
  const hit = selected ? findPattern(kind, selected) : null;
  if (hit) return hit;
  // Tema kaynaklı yüzeylerde ResolvedStyle her zaman geçerli bir değer taşır; slotlarda standart
  const fallback = setting.in === 'style' && view ? view.style[setting.key] : 'standard';
  // Görünüm hiç yoksa (ör. yönetim önizlemesi) türün ilk mevcut (kilitli) uygulaması
  return findPattern(kind, fallback) ?? PATTERN_REGISTRY.find((p) => p.kind === kind && p.legacy)!;
}

/** Bütün yüzeylerin çözümü (önizleme etiketleri ve testler) */
export function resolveSurfaces(view: PatternView | null | undefined): Record<SiteSurface, PatternMeta> {
  return Object.fromEntries(SITE_SURFACES.map((s) => [s, resolvePattern(view, s)])) as Record<SiteSurface, PatternMeta>;
}

/**
 * Seçili desenlerden biri veri katmanından EK veri istiyor mu (ör. Map First → 'map-points')?
 * Sayfa yalnızca bu durumda veri katmanını çağırır; desen veriyi kendisi çekmez.
 */
export function patternNeeds(view: PatternView | null | undefined, need: PatternDataNeed): boolean {
  return Object.values(resolveSurfaces(view)).some((p) => p.needs?.includes(need));
}
