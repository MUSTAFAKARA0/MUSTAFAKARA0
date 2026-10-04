import { Hero } from '@/components/home/hero';
import type { HeroPatternProps } from '@/components/patterns/contracts';
import { BlueprintHero } from '@/components/patterns/hero/blueprint';
import { ImmersiveHero } from '@/components/patterns/hero/immersive';
import { MapSearchHero } from '@/components/patterns/hero/map-search';
import { resolvePattern, type PatternView } from '@/components/patterns/resolver';

/**
 * Ana sayfa (home) yüzeyi: hero. Mevcut düzenler (overlay … showcase) → mevcut Hero, değişmeden
 * (aynı props, aynı çıktı). D7.3 desenleri sunucu bileşenidir (tarayıcı kodu yalnızca ortak
 * HeroSearch); seçilmeyen desenin işaretlemesi sayfaya girmez.
 */
export function HeroSurface({ view, ...props }: HeroPatternProps & { view: PatternView }) {
  const pattern = resolvePattern(view, 'home');
  switch (pattern.id) {
    case 'immersive':
      return <ImmersiveHero {...props} />;
    case 'blueprint':
      return <BlueprintHero {...props} />;
    case 'map-search':
      return <MapSearchHero {...props} />;
    default:
      return (
        <Hero
          tenant={props.tenant}
          options={props.options}
          spotlight={props.spotlight}
          publishedCount={props.publishedCount}
          variant={view.style.hero}
          o={props.content}
        />
      );
  }
}
