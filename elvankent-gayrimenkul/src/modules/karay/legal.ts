/**
 * KARAYS sayfasının (karays.com) yasal metinleri. Bunlar TASLAKTIR: hukuk danışmanı onayı ve şirket bilgileri
 * (unvan, MERSİS/VKN, adres, KEP) girilmeden yayına hazır sayılmaz. Sayfada açıkça "taslak" olarak gösterilir ve
 * arama motorlarına kapalıdır. Kiracı (ofis) sitelerinin yasal metinlerinden ayrıdır: ofis siteleri için veri
 * sorumlusu ofistir, KARAYS veri işleyendir (ofis metinleri: src/modules/content/default-pages.ts).
 *
 * Kaynak: 07.11.2026 hukuk araştırması (KVKK md.5, 9, 10, 11, 12, 13; Aydınlatma Yükümlülüğü Tebliği; Çerez
 * Uygulamaları Rehberi; 6563 md.3; TTK md.39; 5651) — avukat incelemesi için taslak, hukuki tavsiye değildir.
 * Şirket bilgileri TEK yerden doldurulur: KARAYS_COMPANY.
 */
export interface KarayLegalDoc {
  slug: string;
  title: string;
  sections: { heading: string; body: string }[];
}

/** Şirket bilgileri (D-19): sahip bildirene kadar yer tutucu. Doldurulunca tüm metinlere yansır. */
export const KARAYS_COMPANY = {
  unvan: '[KARAYS ticaret unvanı]',
  mersis: '[MERSİS no / şahıs işletmesiyse TC kimlik no yerine vergi no]',
  vergi: '[vergi dairesi ve vergi kimlik no]',
  adres: '[açık adres]',
  kep: '[KEP adresi]',
  eposta: 'karays.support@gmail.com',
  telefon: '[telefon]',
  il: '[il]',
} as const;

const C = KARAYS_COMPANY;
const KIMLIK = `${C.unvan} · ${C.mersis} · ${C.vergi} · Adres: ${C.adres} · E-posta: ${C.eposta} · KEP: ${C.kep} · Telefon: ${C.telefon}`;

const ALT_ISLEYENLER =
  'Supabase Inc. (veritabanı, kimlik doğrulama, dosya depolama; sunucu AB/Almanya – Frankfurt), Vercel Inc. (barındırma ve içerik dağıtımı; AB/Almanya – Frankfurt bölgesi, şirket ABD), Resend (bildirim e-postası iletimi; AB), Functional Software Inc. – Sentry (hata kaydı; e-posta ve telefon maskelenir; AB), Cloudflare Inc. – R2 (şifreli yedek depolama), GitHub Inc. (gece yedeğini çalıştıran otomasyon; ABD), Google LLC – Gmail (destek e-postası; ABD).';

const HAKLAR =
  "KVKK md.11 uyarınca: kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse bilgi talep etme; işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; KVKK md.7'deki şartlar çerçevesinde silinmesini veya yok edilmesini isteme; düzeltme, silme ve yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme; münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonuç ortaya çıkmasına itiraz etme; kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.";

export const KARAY_LEGAL: KarayLegalDoc[] = [
  {
    slug: 'kvkk',
    title: 'KVKK aydınlatma metni',
    sections: [
      { heading: 'Veri sorumlusu', body: `6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz veri sorumlusu sıfatıyla ${C.unvan} ("KARAYS") tarafından işlenir. ${KIMLIK}` },
      {
        heading: 'Kapsam',
        body: "Bu metin; karays.com'daki \"Bilgi al / Demo talep et\" formunu dolduran kişileri, KARAYS'tan hizmet alan emlak ofislerinin yetkilileri ve panel kullanıcılarını ve KARAYS ile e-posta, telefon veya WhatsApp üzerinden iletişime geçen kişileri kapsar. Emlak ofislerinin web sitelerinde doldurulan formlar bakımından veri sorumlusu ilgili ofistir; KARAYS bu verileri yalnızca ofis adına ve talimatıyla veri işleyen olarak işler ve o sitede ofisin aydınlatma metni geçerlidir.",
      },
      {
        heading: 'İşlenen kişisel veriler',
        body: 'Kimlik (ad soyad); iletişim (e-posta, telefon, şehir); mesleki bilgi (emlak ofisinin adı); talep bilgisi (form mesajı, görüşme notları, teklif ve abonelik bilgileri); müşteriler için fatura ve ödeme bilgileri; işlem güvenliği (IP adresinin geri döndürülemez özeti, tarayıcı bilgisi, panel giriş ve denetim kayıtları, iki adımlı doğrulama bilgisi).',
      },
      {
        heading: 'İşleme amaçları ve hukuki sebepler',
        body: "Bilgi/demo talebinize yanıt vermek ve teklif hazırlamak — KVKK md.5/2-(c) bir sözleşmenin kurulmasıyla doğrudan ilgili olması. Hizmet sözleşmesinin ifası, hesap açma, destek ve faturalama — md.5/2-(c) ve (ç) hukuki yükümlülük (Vergi Usul Kanunu, Türk Ticaret Kanunu). Panel güvenliği, yetkilendirme, denetim kayıtları ve kötüye kullanımın önlenmesi — md.5/2-(f) meşru menfaat ve md.12 veri güvenliği yükümlülüğü. Uyuşmazlıklarda hakların korunması — md.5/2-(e). Yetkili kurumların taleplerinin karşılanması — md.5/2-(a) ve (ç). Formdaki onay kutusu bu metni okuduğunuzu belirtir; açık rıza değildir.",
      },
      { heading: 'Toplama yöntemi', body: "Kişisel verileriniz karays.com'daki formlar, KARAYS paneli, e-posta, telefon ve WhatsApp aracılığıyla elektronik ortamda; sözleşme süreçlerinde yazılı olarak toplanır." },
      {
        heading: 'Aktarım ve yurt dışına aktarım',
        body: `Kişisel verileriniz yukarıdaki amaçlarla sınırlı olarak hizmet sağlayıcılarımıza (veri işleyenler) aktarılır: ${ALT_ISLEYENLER} Ayrıca müşteriler için mali müşavir, avukat ve bankalara; talep hâlinde yetkili kamu kurumlarına aktarılabilir. Bu sağlayıcıların sunucuları veya şirketleri Türkiye dışında bulunduğundan aktarım, KVKK md.9 ve Kişisel Verilerin Yurt Dışına Aktarılmasına İlişkin Usul ve Esaslar Hakkında Yönetmelik uyarınca Kurul'ca ilan edilen standart sözleşmeler ve Kurum'a bildirim gibi uygun güvencelerle yapılır. [HUKUK DANIŞMANI: sağlayıcı bazında imza ve bildirim durumu teyit edilmelidir.]`,
      },
      {
        heading: 'Saklama süresi',
        body: 'Müşteriye dönüşmeyen talepler son iletişimden itibaren [2 yıl]; müşteri sözleşme ve fatura kayıtları 10 yıl (TTK md.82, VUK md.253); panel denetim kayıtları (yönetim işlemleri) 2 yıl; spam olarak işaretlenen kayıtlar [90 gün]. Süre sonunda veriler silinir, yok edilir veya anonim hâle getirilir. Ayrıntı: Saklama ve imha özeti.',
      },
      { heading: 'Haklarınız', body: `${HAKLAR} Başvuru yolu için "KVKK başvuru yolu" sayfasına bakınız.` },
    ],
  },
  {
    slug: 'gizlilik',
    title: 'Gizlilik politikası',
    sections: [
      { heading: 'Kapsam', body: `Bu politika ${C.unvan} ("KARAYS") tarafından işletilen karays.com sitesi ve KARAYS yönetim paneli için geçerlidir. KARAYS altyapısıyla yayımlanan emlak ofisi web sitelerinde ilgili ofisin gizlilik politikası ve aydınlatma metni geçerlidir.` },
      { heading: 'Topladığımız bilgiler', body: 'Formlarda kendi isteğinizle verdiğiniz bilgiler (ad soyad, e-posta, telefon, ofis adı, şehir, mesaj); müşterilerimiz için hesap, abonelik ve fatura bilgileri; güvenlik için gerekli teknik kayıtlar (IP adresinin geri döndürülemez özeti, tarayıcı bilgisi, giriş kayıtları). Ham IP adresini form kayıtlarında saklamayız.' },
      { heading: 'Kullanım amaçları', body: 'Talebinize yanıt vermek, hizmeti sunmak ve geliştirmek, güvenliği sağlamak ve yasal yükümlülükleri yerine getirmek. Ayrıntılar KVKK aydınlatma metnindedir.' },
      { heading: 'Paylaşım', body: `Kişisel verilerinizi satmayız ve reklam amacıyla paylaşmayız. Yalnızca hizmeti sunmak için çalıştığımız alt hizmet sağlayıcılarla ve mevzuat gereği yetkili kurumlarla paylaşırız: ${ALT_ISLEYENLER}` },
      { heading: 'Ofis verileri', body: 'Emlak ofislerinin panelde tuttuğu müşteri, talep, randevu ve ilan verileri ofise aittir. KARAYS bu verileri yalnızca veri işleme sözleşmesi çerçevesinde, ofisin talimatıyla ve hizmetin sunulması için işler; kendi amaçları için kullanmaz ve satmaz.' },
      { heading: 'Güvenlik', body: 'Şifreli bağlantı (HTTPS), veritabanında ofisler arası satır bazlı yetkilendirme, rol bazlı yetki, iki adımlı doğrulama, işlem denetim kayıtları, düzenli yedekleme ve geri yükleme provası, hata kayıtlarında kişisel verinin maskelenmesi.' },
      { heading: 'Çerezler, saklama ve haklarınız', body: `Çerezler için Çerez politikası, saklama süreleri için Saklama ve imha özeti, KVKK haklarınız için KVKK başvuru yolu sayfalarına bakınız. Sorularınız: ${C.eposta}.` },
      { heading: 'Değişiklikler', body: 'Bu politika güncellenebilir; önemli değişiklikler sitede ve müşterilerimize e-posta ile duyurulur.' },
    ],
  },
  {
    slug: 'cerez-politikasi',
    title: 'Çerez politikası',
    sections: [
      { heading: 'Kapsam', body: "Bu politika karays.com ve KARAYS panelinde kullanılan çerezler ve benzeri teknolojiler (tarayıcı yerel depolaması) hakkında bilgi verir; KVKK'nın Çerez Uygulamaları Hakkında Rehberi dikkate alınmıştır." },
      {
        heading: 'Zorunlu çerezler ve depolama (onay gerekmez)',
        body: 'eg:consent (tarayıcı yerel depolaması; çerez tercihinizi 12 ay saklar). Yalnızca panele giriş yapan kullanıcılar için: sb-…-auth-token (oturumun güvenli sürdürülmesi; birden fazla parçaya bölünebilir), eg_scope (giriş yapılan alanın seçimi; tarayıcı oturumu), eg_active_org (seçili kurum; 180 gün). Bu kayıtlar talep ettiğiniz hizmetin ve güvenliğin sağlanması için gereklidir ve birinci taraftır.',
      },
      {
        heading: 'Analitik (yalnızca onayınızla)',
        body: 'Vercel Web Analytics (anonim ziyaret istatistiği) ve Vercel Speed Insights (sayfa hızı ölçümü) yalnızca çerez bandında "Kabul et" demeniz ya da tercihlerde "Analitik" seçeneğini açmanız hâlinde yüklenir; onayınızı "Çerez tercihleri" bağlantısından her zaman geri çekebilirsiniz; çerez kullanmazlar. Sağlayıcı Vercel Inc. (ABD). Reklam veya pazarlama çerezi kullanılmaz.',
      },
      { heading: 'Tercihinizi değiştirme', body: 'Kabul ve ret seçenekleri bantta eşit olarak sunulur. Tercihinizi sayfanın altındaki "Çerez tercihleri" bağlantısından her zaman değiştirebilir veya tarayıcı ayarlarınızdan silebilirsiniz; zorunlu çerezleri engellerseniz panele giriş yapılamayabilir.' },
      { heading: 'İletişim', body: `${C.eposta} · Ayrıntılar için KVKK aydınlatma metni.` },
    ],
  },
  {
    slug: 'kullanim-kosullari',
    title: 'Kullanım koşulları ve hizmet sözleşmesi özeti',
    sections: [
      { heading: 'Taraflar ve nitelik', body: `${C.unvan} ("KARAYS") ile hizmeti satın alan emlak işletmesi ("Müşteri"). Müşteri sözleşmeyi ticari veya mesleki faaliyeti kapsamında kurar ve tüketici sıfatı taşımaz; bu nedenle tüketici mevzuatı (6502 sayılı Kanun, Mesafeli Sözleşmeler Yönetmeliği) uygulanmaz. Bu özet, taraflarca kabul edilecek tam hizmet sözleşmesinin yerini tutmaz.` },
      { heading: 'Hizmet', body: 'Müşterinin alan adında barındırılan web sitesi, ilan yönetimi, müşteri/talep ve randevu modülleri, site düzenleyici, yedekleme ve teknik destek. Plan kapsamı, limitler ve ücretler teklif ve sipariş özetinde belirtilir.' },
      { heading: 'Müşterinin sorumlulukları', body: "İlan ve site içeriğinin (fiyat, metrekare, imar, fotoğraf, telif) doğruluğu ve hukuka uygunluğu Müşteriye aittir. Müşteri; Taşınmaz Ticareti Hakkında Yönetmelik'e uygun olarak ilanlarında yetki belgesi numarasını ve iletişim bilgilerini göstermeyi, mülk sahibiyle yazılı yetkilendirme sözleşmesi olmadan ilan yayımlamamayı, ticari elektronik ileti mevzuatına uymayı ve kendi sitesinin veri sorumlusu olarak KVKK yükümlülüklerini yerine getirmeyi kabul eder." },
      { heading: 'İçerik bildirimleri', body: `KARAYS, Müşteri içeriğini önceden denetlemekle yükümlü değildir; hukuka aykırı içeriğin usulüne uygun bildirimi veya yetkili merci kararı hâlinde içeriği yayından kaldırabilir ve Müşteriyi bilgilendirir. Bildirimler: ${C.eposta}.` },
      { heading: 'Kişisel veriler', body: 'Müşterinin site ve panel verileri bakımından Müşteri veri sorumlusu, KARAYS veri işleyendir; ilişki "Veri işleme sözleşmesi" sayfasındaki hükümlere tabidir.' },
      { heading: 'Fikri mülkiyet', body: 'Yazılım, tema ve şablonlar KARAYS\'a aittir; Müşteriye sözleşme süresince devredilemez, münhasır olmayan kullanım lisansı verilir. Müşteri içeriği ve alan adı Müşteriye aittir.' },
      { heading: 'Fesih ve verilerin iadesi', body: 'Fesih sonrası Müşteri [30] gün boyunca verilerini dışa aktarabilir; ardından veriler canlı sistemden ve yedeklerden en geç [90] gün içinde silinir (yasal saklama zorunluluğu olanlar hariç).' },
      { heading: 'Sorumluluk, değişiklik ve yetki', body: `KARAYS'ın sorumluluğu, kast ve ağır ihmal hâlleri hariç (TBK md.115), zarar tarihinden önceki [12] ayda ödenen ücretle sınırlıdır. Müşteri aleyhine değişiklikler en az [30] gün önceden bildirilir. Türk hukuku uygulanır; ${C.il} mahkemeleri ve icra daireleri yetkilidir; ticari uyuşmazlıklarda dava şartı arabuluculuk uygulanır.` },
    ],
  },
  {
    slug: 'veri-isleme-sozlesmesi',
    title: 'Veri işleme sözleşmesi (özet)',
    sections: [
      { heading: 'Taraflar ve konu', body: `Veri sorumlusu: hizmet alan emlak ofisi ("Ofis"). Veri işleyen: ${C.unvan} ("KARAYS"). KARAYS, hizmet sözleşmesi kapsamında Ofis adına ve Ofis'in talimatıyla kişisel verileri işler; bu sözleşme hizmet sözleşmesinin eki ve ayrılmaz parçasıdır.` },
      { heading: 'İşlemenin niteliği', body: "İlgili kişiler: Ofis web sitesi ziyaretçileri ve form dolduranlar, Ofis'in müşterileri ve adayları, Ofis çalışanları ve panel kullanıcıları. Veriler: kimlik, iletişim, talep ve müşteri işlem bilgileri, işlem güvenliği kayıtları, gayrimenkul bilgileri. Özel nitelikli kişisel veri işlenmesi amaçlanmaz; Ofis serbest metin alanlarına bu tür veri girmemeyi taahhüt eder." },
      { heading: "KARAYS'ın yükümlülükleri", body: "Verileri yalnızca Ofis'in talimatıyla ve hizmet amacıyla işler, kendi amaçları için kullanmaz ve satmaz; personelini gizlilikle yükümlü kılar; KVKK md.12 kapsamındaki teknik ve idari tedbirleri alır; ilgili kişi başvurularının yanıtlanması için dışa aktarma, düzeltme ve silme işlevlerini sağlar ve KARAYS'a gelen başvuruları [3] iş günü içinde Ofis'e iletir." },
      { heading: 'Alt veri işleyenler ve yurt dışı aktarım', body: `Ofis şu alt veri işleyenlere onay verir: ${ALT_ISLEYENLER} Yeni bir alt veri işleyen en az [30] gün önce bildirilir; Ofis haklı gerekçeyle itiraz edebilir. Yurt dışına aktarım KVKK md.9'daki uygun güvencelerle (standart sözleşme ve Kurum'a bildirim) yapılır.` },
      { heading: 'Veri ihlali', body: "KARAYS, Ofis verilerini etkileyen bir ihlali öğrendiği andan itibaren gecikmeksizin ve en geç 24 saat içinde Ofis'e bildirir ve Ofis'in Kurul'a 72 saat içinde bildirim yapabilmesi için gereken bilgiyi sağlar." },
      { heading: 'Sözleşme sonu', body: 'Hizmet sona erdiğinde Ofis [30] gün boyunca verilerini dışa aktarabilir; ardından KARAYS verileri canlı sistemden ve yedeklerden en geç [90] gün içinde siler ve talep hâlinde silme beyanı verir.' },
      { heading: 'Teknik tedbirler', body: 'TLS şifreleme; ofisler arası satır bazlı yetkilendirme; rol bazlı erişim ve iki adımlı doğrulama; denetim kayıtları; form kayıtlarında ham IP yerine geri döndürülemez özet; hız sınırlama; günlük yedekleme ve geri yükleme provası; hata kayıtlarında e-posta ve telefon maskelenmesi.' },
    ],
  },
  {
    slug: 'saklama-ve-imha',
    title: 'Saklama ve imha özeti',
    sections: [
      { heading: 'Dayanak', body: 'KVKK md.7 ve Kişisel Verilerin Silinmesi, Yok Edilmesi veya Anonim Hale Getirilmesi Hakkında Yönetmelik.' },
      { heading: 'Süreler', body: 'Müşteriye dönüşmeyen demo/bilgi talepleri: son iletişimden itibaren [2 yıl]. Spam olarak işaretlenen talepler: [90 gün]. Müşteri sözleşme, fatura ve ödeme kayıtları: 10 yıl. Panel kullanıcı hesapları: sözleşme süresi + [30 gün]. Denetim kayıtları: 2 yıl. Hata kayıtları (Sentry): sağlayıcı ayarı [90 gün]. Yedekler: [30] günlük döngü. Ofis verileri (veri işleyen sıfatıyla): Ofis talimatı; sözleşme bitiminde [30] gün dışa aktarma ve en geç [90] gün içinde silme.' },
      { heading: 'İmha', body: 'Süresi dolan veriler periyodik olarak (en geç 6 ayda bir) silinir, yok edilir veya anonim hâle getirilir; ilgili kişinin silme talebi en geç 30 gün içinde sonuçlandırılır. Denetim kayıtlarının 2 yıl sonunda silinmesi otomatiktir; diğer sürelerin otomasyonu hazırlanmaktadır.' },
    ],
  },
  {
    slug: 'basvuru',
    title: 'KVKK başvuru yolu',
    sections: [
      { heading: 'Kime başvurmalısınız?', body: "KARAYS sitesi, KARAYS'a ilettiğiniz talepler veya KARAYS müşterisi ya da kullanıcısı olmanızla ilgili verileriniz için KARAYS'a. Bir emlak ofisinin web sitesinde doldurduğunuz form veya o ofisle ilişkiniz için ilgili ofise (iletişim bilgisi ofis sitesinin KVKK sayfasındadır). KARAYS'a gönderilen bu tür başvurular [3] iş günü içinde ilgili ofise iletilir ve size bilgi verilir." },
      { heading: 'Başvuru yöntemleri', body: `Islak imzalı dilekçe ile şahsen veya noter aracılığıyla: ${C.adres}. Kayıtlı elektronik posta (KEP) ile: ${C.kep}. Güvenli elektronik imza veya mobil imzalı e-posta ile ya da daha önce bize bildirdiğiniz ve sistemimizde kayıtlı e-posta adresinizden: ${C.eposta}.` },
      { heading: 'Başvuruda bulunması gerekenler', body: 'Ad, soyad ve (yazılı başvuruda) imza; T.C. kimlik numarası (yabancılar için uyruk ve pasaport/kimlik numarası); tebligata esas yerleşim yeri veya iş yeri adresi; varsa bildirime esas e-posta, telefon veya faks numarası; talep konusu. Konuya ilişkin belgeler eklenebilir.' },
      { heading: 'Yanıt süresi ve şikâyet', body: "Başvurunuz en geç 30 gün içinde ücretsiz sonuçlandırılır (KVKK md.13); işlem ayrıca maliyet gerektirirse Kurul'un belirlediği tarifedeki ücret alınabilir. Başvurunuz reddedilir, cevabı yetersiz bulur veya süresinde cevap alamazsanız, cevabı öğrendiğiniz tarihten itibaren 30 gün ve her hâlde başvuru tarihinden itibaren 60 gün içinde Kişisel Verileri Koruma Kurulu'na şikâyette bulunabilirsiniz (KVKK md.14)." },
    ],
  },
  {
    slug: 'kunye',
    title: 'Künye ve iletişim',
    sections: [
      { heading: 'Hizmet sağlayıcı', body: `${KIMLIK}` },
      { heading: 'Bilgilendirme', body: "Bu bilgiler 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun md.3 ve Türk Ticaret Kanunu md.39 kapsamındaki zorunlu bilgilerdir. Meslek odası ve meslek kuralları: [varsa]." },
    ],
  },
];

export function findKarayLegal(slug: string): KarayLegalDoc | null {
  return KARAY_LEGAL.find((d) => d.slug === slug) ?? null;
}
