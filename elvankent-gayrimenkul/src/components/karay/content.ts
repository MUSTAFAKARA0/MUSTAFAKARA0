import {
  BarChart3,
  Building2,
  Eye,
  FileClock,
  Globe,
  Inbox,
  LayoutTemplate,
  Palette,
  Search,
  ShieldCheck,
  Smartphone,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { THEME_LIST } from '@/theme-engine/themes';

/*
 * KARAYS sayfasının içeriği. Yalnızca platformda GERÇEKTEN var olan özellikler anlatılır; müşteri sayısı,
 * istatistik, referans veya yorum yoktur. Sayfadaki her sayı bu dizilerin uzunluğundan türetilir.
 */

export type FeatureKey = 'web' | 'ilan' | 'crm' | 'talep' | 'marka' | 'yayin' | 'seo' | 'alan' | 'mobil' | 'olcum' | 'guvenlik' | 'surum';

export const FEATURES: readonly { key: FeatureKey; icon: LucideIcon; title: string; text: string }[] = [
  { key: 'web', icon: LayoutTemplate, title: 'Profesyonel emlak web sitesi', text: 'Hazır sayfalar: ilanlar, bölgeler, hizmetler, değerleme talebi, blog, iletişim. Kod yazmadan yayına alınır.' },
  { key: 'ilan', icon: Building2, title: 'İlan yönetimi', text: 'Adım adım ilan girişi, çoklu fotoğraf, taslak ve onay akışı, satıldı/kiralandı durumu, PDF broşür ve QR kod.' },
  { key: 'crm', icon: Users, title: 'CRM ve müşteri yönetimi', text: 'Müşteri kartları, randevular, ilan koleksiyonları ve müşteriye özel paylaşım bağlantıları.' },
  { key: 'talep', icon: Inbox, title: 'Talep yönetimi', text: 'Web sitesinden gelen iletişim, ilan ve değerleme talepleri tek listede; e-posta bildirimi ve durum takibi.' },
  { key: 'marka', icon: Palette, title: 'Marka ve tema', text: `${THEME_LIST.length} farklı tema, hazır renk paletleri, yazı tipi, logo ve header/footer ayarları. Her ofis kendi markasıyla.` },
  { key: 'yayin', icon: Eye, title: 'Taslak → önizleme → yayın', text: 'Değişiklikler önce taslağa kaydedilir, canlı siteyi bozmadan önizlenir, tek tıkla yayınlanır; eski sürüme dönülebilir.' },
  { key: 'seo', icon: Search, title: 'SEO', text: 'Sayfa başlıkları, açıklamalar, paylaşım görselleri, site haritası, kanonik adresler ve yapılandırılmış veri (RealEstateAgent).' },
  { key: 'alan', icon: Globe, title: 'Kendi alan adınız', text: 'Site kendi alan adınızda yayınlanır; DNS adımları panelde gösterilir.' },
  { key: 'mobil', icon: Smartphone, title: 'Mobil uyumlu', text: 'Site ve yönetim paneli telefonda uygulama gibi çalışır: menü, filtreler, formlar ve fotoğraflar mobile göre tasarlandı.' },
  { key: 'olcum', icon: BarChart3, title: 'Ölçüm', text: 'İlan görüntülenme, favori, WhatsApp ve telefon tıklamaları ile talep kaynakları panelde; yalnızca gerçek veriler.' },
  { key: 'guvenlik', icon: ShieldCheck, title: 'Güvenlik ve yalıtım', text: 'Her ofisin verisi veritabanı düzeyinde (RLS) ayrıdır; rol bazlı yetki, iki adımlı doğrulama ve işlem kayıtları.' },
  { key: 'surum', icon: FileClock, title: 'Sürüm geçmişi', text: 'Her yayın bir sürümdür; kim, ne zaman, hangi notla yayınladı görülür ve önceki sürüme dönülür.' },
];

export const PROBLEMS = [
  'Web sitesi bir ajansa bağlı; küçük bir değişiklik için bile beklemek gerekiyor.',
  'İlanlar, müşteriler ve gelen talepler farklı yerlerde dağınık duruyor.',
  'Site hazır bir şablona benziyor; ofisin kendi markasını yansıtmıyor.',
  'Telefonda yavaş ya da kullanışsız bir site ziyaretçiyi kaybettiriyor.',
  'Arama motorlarında görünürlük için teknik ayarlar yapılmamış.',
] as const;

export const SOLUTIONS = [
  'Web siteniz, ilanlarınız ve müşterileriniz tek panelde.',
  'Markanızı, temanızı ve menünüzü kendiniz yönetin; önce önizleyin, sonra yayınlayın.',
  'Siteden gelen her talep otomatik olarak panelinize düşer.',
  'Mobil öncelikli, hızlı ve SEO uyumlu altyapı hazır gelir.',
  'Kendi alan adınız, kendi logonuz: sitede platformun değil, sizin markanız görünür.',
] as const;

export const STEPS = [
  { title: 'Tanışma', text: 'Formu doldurun; ofisinizi, ilan sayınızı ve ihtiyaçlarınızı konuşalım.' },
  { title: 'Kurulum', text: 'Ofisiniz platformda açılır; logo, renkler, tema ve iletişim bilgileriniz taslak olarak hazırlanır.' },
  { title: 'Önizleme ve alan adı', text: 'Sitenizi yayından önce önizlersiniz; alan adınız bağlanır.' },
  { title: 'Yayın ve yönetim', text: 'Site yayına alınır; ilanlarınızı, taleplerinizi ve müşterilerinizi kendi panelinizden yönetirsiniz.' },
] as const;

/** Yayın akışı: sticky anlatımın dört adımı; chip, ürün arayüzündeki durum kavramlarıdır (Taslak, Önizleme, Canlı, Önceki sürüm) */
export const WALK_STEPS = [
  { title: 'Taslağa kaydedin', text: 'Değişiklikler önce taslağa yazılır; ziyaretçileriniz hiçbir şey görmez.', chip: 'Taslak' },
  { title: 'Önizleyin', text: 'Taslağı yalnızca sizin tarayıcınızda görün; ziyaretçiler canlı siteyi görmeye devam eder.', chip: 'Önizleme' },
  { title: 'Yayınlayın', text: 'Tek tıkla canlıya alın; her yayın yeni bir sürümdür.', chip: 'Canlı' },
  { title: 'Gerekirse geri alın', text: 'Geçmiş sekmesinden önceki sürüme dönün.', chip: 'Önceki sürüm' },
] as const;

export const ROLES = ['Sahip', 'Yönetici', 'Danışman', 'Editör', 'İzleyici'] as const;

/** Tek panelde yönetilen alanlar (hero'daki vurgulu satır); hepsi FEATURES'ta karşılığı olan gerçek özelliklerdir */
export const PANEL_WORDS = ['web siteniz', 'ilanlarınız', 'müşterileriniz', 'talepleriniz', 'markanız'] as const;

export const SECURITY = [
  ['Veritabanı düzeyinde yalıtım', 'Satır düzeyi güvenlik (RLS): bir ofis başka bir ofisin ilanını, müşterisini veya talebini okuyamaz.'],
  ['Rol bazlı yetki', 'Sahip, yönetici, danışman, editör ve izleyici rolleri; her işlem sunucuda yetkiyle kontrol edilir.'],
  ['İki adımlı doğrulama', 'Yöneticiler için doğrulama uygulamasıyla (TOTP) ikinci adım; ofis bunu zorunlu kılabilir.'],
  ['İşlem kayıtları', 'Önemli işlemler (yayın, marka, kullanıcı, ayar değişikliği) kim ve ne zaman bilgisiyle kaydedilir.'],
] as const;

export const FAQ = [
  { q: 'KARAYS bir emlak ofisi mi?', a: 'Hayır. KARAYS, emlak ofislerine yazılım altyapısı sağlayan bir gayrimenkul teknolojileri şirketidir. İlan sahibi değildir, emlak hizmeti vermez.' },
  { q: 'Sitemde KARAYS adı görünür mü?', a: 'Hayır. Siteniz kendi logonuz, adınız, renkleriniz ve alan adınızla yayınlanır (beyaz etiket).' },
  { q: 'Mevcut alan adımı kullanabilir miyim?', a: 'Evet. Alan adınız platforma bağlanır; gerekli DNS kayıtları panelde adım adım gösterilir.' },
  { q: 'Verilerim diğer ofislerle karışır mı?', a: 'Hayır. Her ofisin ilanları, müşterileri ve talepleri veritabanı düzeyinde ayrıdır; bir ofis başka bir ofisin verisini göremez.' },
  { q: 'Sitenin görünümünü kendim değiştirebilir miyim?', a: `Evet. ${THEME_LIST.length} tema, renk paletleri, yazı tipleri, menü, ana sayfa bölümleri ve footer ayarlanabilir. Değişiklikler önce taslakta önizlenir, sonra yayınlanır.` },
  { q: 'Fiyatlandırma nasıl?', a: 'Ofisinizin ihtiyaçlarına göre bilgi veriyoruz. "Bilgi al" formunu doldurmanız yeterli.' },
] as const;
