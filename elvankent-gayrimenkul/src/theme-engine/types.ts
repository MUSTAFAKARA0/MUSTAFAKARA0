import type { ThemeId } from '@/theme-engine/ids';
import type { ColorsConfig, StyleConfig, TypographyConfig } from '@/theme-engine/settings';

/**
 * Theme Engine'in TEK girdisi: kiracının tema seçimi ve tema ayarları (veri). Site
 * yapılandırması (SiteConfig) bu arayüzü yapısal olarak karşılar; Theme Engine sitenin
 * menü, sayfa, SEO gibi diğer alanlarını görmez.
 */
export interface ThemeInput {
  theme: ThemeId;
  colors: ColorsConfig;
  typography: TypographyConfig;
  style: StyleConfig;
  /** Header'ın tema varyasyonu (açık/koyu); boşsa temanın varsayılanı */
  header?: { style?: 'light' | 'dark' };
}

/** Ofisin marka renkleri (Şirket Ayarları); renk modu "brand" iken kullanılır */
export interface BrandColors {
  primary_color: string | null;
  accent_color: string | null;
}
