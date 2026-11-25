import type { DesignFamily } from '@/site-factory/types';
import dogalYasam from '@/site-factory/catalog/dogal-yasam';
import editoryalLuks from '@/site-factory/catalog/editoryal-luks';
import klasikGuven from '@/site-factory/catalog/klasik-guven';
import kurumsalPortfoy from '@/site-factory/catalog/kurumsal-portfoy';
import sinematikVitrin from '@/site-factory/catalog/sinematik-vitrin';
import yalinGaleri from '@/site-factory/catalog/yalin-galeri';
import luxury from '@/site-factory/catalog/luxury';
import architectural from '@/site-factory/catalog/architectural';
import mapFirst from '@/site-factory/catalog/map-first';
import denizKiyisi from '@/site-factory/catalog/deniz-kiyisi';
import projeLansman from '@/site-factory/catalog/proje-lansman';
import plazaOfis from '@/site-factory/catalog/plaza-ofis';
import arsaTarla from '@/site-factory/catalog/arsa-tarla';
import kurumsalZincir from '@/site-factory/catalog/kurumsal-zincir';
import butikOfis from '@/site-factory/catalog/butik-ofis';
import kiralikMerkezi from '@/site-factory/catalog/kiralik-merkezi';
import mirasKonak from '@/site-factory/catalog/miras-konak';
import gecePremium from '@/site-factory/catalog/gece-premium';

/**
 * TASARIM KATALOĞU — klasör sözleşmesi.
 *
 *   src/site-factory/catalog/<aile-kimliği>/index.ts   → export default defineFamily({ id: '<aile-kimliği>', … })
 *
 * Yeni aile eklemek:
 *   1. catalog/<yeni-aile>/index.ts oluşturun (yalnızca veri: tema, palet, parçalar, kompozisyon).
 *   2. Aşağıdaki listeye ekleyin.
 *   3. `npm run test:unit` → sözleşme testleri (tests/unit/site-catalog.test.mjs) klasörün
 *      kayıtlı olduğunu, kimliğin klasör adıyla aynı olduğunu, ailenin geçerli bir manifeste
 *      derlendiğini ve diğer ailelerin derlenmiş çıktısının DEĞİŞMEDİĞİNİ doğrular.
 *
 * Katalog yalnızca KARAY yüzeylerinde (sihirbaz, Site Builder, önizleme) kullanılır. Kiracı
 * sitesi bu klasörü içe aktaramaz (ESLint sınırı + boundaries testi): yeni bir aile mevcut hiçbir
 * kiracının sayfasını, CSS'ini, JS'ini veya yazı tiplerini değiştirmez. Kiracı yalnızca kendi
 * manifestini (site_configs) okur.
 */
/** Katalog salt okunurdur: bir kiracının derlemesi veya bir hata ortak aile nesnesini değiştiremez */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// İlk 6 aile kilitli (D7 öncesi); D7.3 aileleri yüzey desenleriyle (style.slots) gelir.
// 10–18. aileler (Faz 1 katalog genişlemesi) SONA eklenir: sıra asla değişmez (galeri ve kilit testleri sıraya bağlıdır).
export const CATALOG: readonly DesignFamily[] = deepFreeze([klasikGuven, sinematikVitrin, editoryalLuks, kurumsalPortfoy, yalinGaleri, dogalYasam, luxury, architectural, mapFirst, denizKiyisi, projeLansman, plazaOfis, arsaTarla, kurumsalZincir, butikOfis, kiralikMerkezi, mirasKonak, gecePremium]);
