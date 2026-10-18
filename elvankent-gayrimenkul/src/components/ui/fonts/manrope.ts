// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
// Manrope: alt küme modülleri Google'ın CSS sırasıyla (çakışan aralıklarda sonraki tanım önceliklidir)
import './manrope-fallback.css';
import './manrope-cyrillic-ext';
import './manrope-cyrillic';
import './manrope-greek';
import './manrope-vietnamese';
import './manrope-latin-ext';

export { Manrope as manrope } from './manrope-latin';
