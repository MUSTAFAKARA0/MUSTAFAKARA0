import { headerModel, type HeaderPatternInput } from '@/components/patterns/header/parts';
import { cn } from '@/lib/utils';

/**
 * Header deseni · transparent (Luxury): düşük arayüz yoğunluğu. Ortada logo; solda menü düğmesi
 * (masaüstünde de — menü bağlantıları satırda dizilmez), sağda yalnızca çağrı ve favoriler.
 * Sayfa kenardan kenara bir görselle açılıyorsa (immersive hero / tam genişlik galeri) header
 * görselin ÜZERİNDE saydamdır; kaydırınca (scroll-header adası) ve diğer sayfalarda düz zemin.
 * Yalnızca CSS + mevcut istemci parçaları; yeni tarayıcı kodu yok.
 */
export function TransparentHeader(props: HeaderPatternInput) {
  const m = headerModel(props);
  return (
    <header data-pattern="karay-pattern:header/transparent" className={cn('site-header kp-header-transparent top-0 z-40', m.h.sticky ? 'sticky' : 'relative')}>
      <div className="kp-hdr-bar container-page">
        <div className="kp-hdr-left">{m.menu()}</div>
        {m.logo('kp-hdr-logo max-w-full')}
        <div className="kp-hdr-right">{m.quick({ compact: true })}</div>
      </div>
    </header>
  );
}
