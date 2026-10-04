import type { InteractionPattern } from '@/theme-engine/ids';

/**
 * Etkileşim desenlerinin CSS'i (yalnızca veri). Yalnızca deseni seçen sitenin sayfasına yazılır
 * (patterns/styles.ts). Hareket kısıtlaması (prefers-reduced-motion) her parçada uygulanır.
 */
export const INTERACTION_CSS: Record<InteractionPattern, string> = {
  'scroll-header':
    `[data-site-theme] .site-header{transition:box-shadow .25s ease,background-color .25s ease}` +
    `html[data-site-scrolled] [data-site-theme] .site-header{box-shadow:0 10px 30px -22px rgb(15 23 20 / .45)}` +
    `@media (prefers-reduced-motion:reduce){[data-site-theme] .site-header{transition:none}}`,
  'image-reveal':
    `[data-site-theme] main img{transition:opacity .5s ease}` +
    `[data-site-theme] main img[data-reveal-pending]{opacity:0}` +
    `@media (prefers-reduced-motion:reduce){[data-site-theme] main img{transition:none}}`,
};
