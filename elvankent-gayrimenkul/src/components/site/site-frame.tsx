import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { CompareBar, CookieConsent, FloatingWhatsApp } from '@/components/layout/site-extras';
import { PreviewBar } from '@/components/layout/site-status';
import { InteractionIslands } from '@/components/patterns/interaction/islands';
import { resolveSurfaces } from '@/components/patterns/resolver';
import { patternCss } from '@/components/patterns/styles';
import { whatsappHref } from '@/lib/contact-links';
import { hashString } from '@/lib/utils';
import type { Tenant } from '@/platform/tenant/tenant';
import type { SiteView } from '@/site-config/load';
import { applyTheme } from '@/theme-engine';
import { fontPackageCss, fontPreloads, resolveFontIds } from '@/theme-engine/typography/font-css';

/**
 * SITE RENDERER SÖZLEŞMESİ — kiracı sitesi ve KARAY önizlemesi AYNI bileşenleri kullanır:
 *
 *   manifest (site_configs) → SiteView → <SiteFrame> (tema, yazı tipi paketi, header, footer)
 *                                        <SiteHome>  (ana sayfa bölümleri)
 *
 * Kiracı: app/t/[tenant] gerçek veriyle çağırır. Önizleme: app/site-onizleme aynı bileşenleri
 * manifestten derlenen SiteView ve örnek veriyle çağırır. İki giriş noktası ayrı rotalardır;
 * önizleme kodu kiracı paketine, kiracı uygulamasının geri kalanı önizlemeye girmez.
 */

/** Sitenin görsel çalışma zamanı: yalnızca seçili tema/varyant CSS'i ve seçili yazı tipi paketi */
export function siteRuntime(tenant: Tenant, view: SiteView, version: string | number) {
  const { css, attributes } = applyTheme(view.config, tenant.settings, view.features.darkMode);
  // Anahtar içerikten türetilir: ofis rengini değiştirdiğinde (sürüm aynı kalsa da) yeni stil yüklenir
  const styleKey = `site-${tenant.id}-${version}-${hashString(css)}`;
  // Tipografi paketi: yalnızca bu sitenin başlık/gövde yazı tipleri (katalogdaki diğerleri sayfaya girmez)
  const fontIds = resolveFontIds(view.config);
  // Ön yükleme bağlantıları React tarafından <head>'e taşınır ("optional" yazı tipi ilk çizime yetişir)
  const head = (
    <>
      {fontPreloads(fontIds).map((href) => (
        <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
      <style href={`site-fonts-${fontIds.join('-')}`} precedence="high">
        {fontPackageCss(fontIds)}
      </style>
      <style href={styleKey} precedence="high">
        {css}
      </style>
    </>
  );
  return { attributes, head };
}

export interface SiteFrameProps {
  tenant: Tenant;
  view: SiteView;
  hasBlog: boolean;
  regions: { slug: string; name: string }[];
  version: string | number;
  /** live: ziyaretçi sitesi (çerez bildirimi, karşılaştırma çubuğu) · preview: KARAY önizlemesi */
  mode?: 'live' | 'preview';
  children: ReactNode;
}

export function SiteFrame({ tenant, view, hasBlog, regions, version, mode = 'live', children }: SiteFrameProps) {
  const s = tenant.settings;
  const { attributes, head } = siteRuntime(tenant, view, version);
  // D7 desenleri: yalnızca manifestte seçilen etkileşim adaları ve CSS'leri (seçim yoksa hiçbir şey)
  const interactions = view.config.style.slots?.interactions ?? [];
  // D7.3 yüzey desenleri: yalnızca seçilenlerin (standart olmayanların) CSS'i; standart → hiçbir şey
  const surfaces = [...new Set(Object.values(resolveSurfaces(view)).filter((p) => !p.legacy).map((p) => `${p.kind}/${p.id}`))].sort();
  const surfaceCss = patternCss({ surfaces });
  return (
    <div {...attributes} className="contents">
      {head}
      {mode === 'live' && view.preview && <PreviewBar />}
      <a
        href="#icerik"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-xl focus:bg-surface focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:shadow-md"
      >
        İçeriğe geç
      </a>
      <SiteHeader tenant={tenant} hasBlog={hasBlog} view={view} />
      <main id="icerik" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter tenant={tenant} regions={regions} hasBlog={hasBlog} view={view} />
      {surfaceCss && (
        <style href={`site-surfaces-${hashString(surfaceCss)}`} precedence="high">
          {surfaceCss}
        </style>
      )}
      {interactions.length > 0 && (
        <>
          <style href={`site-patterns-${interactions.join('-')}`} precedence="high">
            {patternCss({ interactions })}
          </style>
          <InteractionIslands ids={interactions} />
        </>
      )}
      {view.features.whatsapp && <FloatingWhatsApp href={whatsappHref(s.whatsapp ?? s.phone, 'Merhaba, bilgi almak istiyorum.')} />}
      {mode === 'live' && view.features.favorites && <CompareBar />}
      {mode === 'live' && <CookieConsent />}
    </div>
  );
}
