// OTOMATİK ÜRETİLİR — elle düzenlemeyin: node scripts/fonts/build-local-fonts.mjs
// Fraunces: alt küme modülleri Google'ın CSS sırasıyla (çakışan aralıklarda sonraki tanım önceliklidir)
import './fraunces-fallback.css';
import './fraunces-vietnamese';
import './fraunces-latin-ext';

export { Fraunces as fraunces } from './fraunces-latin';
