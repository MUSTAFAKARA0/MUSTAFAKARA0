import type { DesignFamily } from '@/site-factory/types';
import dogalYasam from '@/site-factory/catalog/dogal-yasam';
import editoryalLuks from '@/site-factory/catalog/editoryal-luks';
import klasikGuven from '@/site-factory/catalog/klasik-guven';
import kurumsalPortfoy from '@/site-factory/catalog/kurumsal-portfoy';
import sinematikVitrin from '@/site-factory/catalog/sinematik-vitrin';
import yalinGaleri from '@/site-factory/catalog/yalin-galeri';

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
export const CATALOG: readonly DesignFamily[] = [klasikGuven, sinematikVitrin, editoryalLuks, kurumsalPortfoy, yalinGaleri, dogalYasam];
