// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
// Poppins: alt küme modülleri Google'ın CSS sırasıyla (çakışan aralıklarda sonraki tanım önceliklidir)
import './poppins-fallback.css';
import './poppins-devanagari';
import './poppins-latin-ext';

export { Poppins as poppins } from './poppins-latin';
