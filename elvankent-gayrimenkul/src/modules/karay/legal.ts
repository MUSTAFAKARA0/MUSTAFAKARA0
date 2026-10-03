/**
 * KARAY sayfasının yasal metinleri. Bunlar TASLAKTIR: hukuki inceleme ve şirket bilgileri
 * (unvan, adres, VERBİS, iletişim) girilmeden yayına hazır sayılmaz. Sayfada açıkça
 * "taslak" olarak gösterilir ve arama motorlarına kapalıdır. Kiracı sitelerinin yasal
 * metinlerinden ayrıdır (her ofisin kendi metinleri kendi panelindedir).
 */
export interface KarayLegalDoc {
  slug: string;
  title: string;
  sections: { heading: string; body: string }[];
}

const pending = '[Şirket bilgileri girilecek]';

export const KARAY_LEGAL: KarayLegalDoc[] = [
  {
    slug: 'kvkk',
    title: 'KVKK aydınlatma metni',
    sections: [
      { heading: 'Veri sorumlusu', body: `KARAY Gayrimenkul Teknolojileri — ${pending} (unvan, adres, iletişim ve varsa VERBİS kaydı).` },
      {
        heading: 'İşlenen kişisel veriler',
        body: 'KARAY sayfasındaki "Bilgi al / Demo talep et" formu ile ilettiğiniz ad soyad, e-posta, telefon, emlak ofisi adı, şehir ve mesaj bilgileri; güvenlik amacıyla IP adresinin geri döndürülemez özeti ve tarayıcı bilgisi.',
      },
      { heading: 'İşleme amacı', body: 'Talebinize yanıt vermek, platform hakkında bilgi ve demo sunmak, kötüye kullanımı (spam) önlemek.' },
      { heading: 'Hukuki sebep', body: `${pending} — hukuki inceleme sonrası belirlenecektir.` },
      { heading: 'Saklama süresi', body: `${pending} — hukuki inceleme sonrası belirlenecektir.` },
      { heading: 'Haklarınız', body: `KVKK'nın 11. maddesindeki haklarınızı ${pending} adresine başvurarak kullanabilirsiniz.` },
    ],
  },
  {
    slug: 'gizlilik',
    title: 'Gizlilik politikası',
    sections: [
      { heading: 'Kapsam', body: 'Bu metin yalnızca KARAY şirket sayfasını kapsar. Platformu kullanan emlak ofislerinin web sitelerinde o ofisin kendi gizlilik metni geçerlidir.' },
      { heading: 'Toplanan bilgiler', body: 'Yalnızca iletişim formunda kendi isteğinizle ilettiğiniz bilgiler ve güvenlik için gerekli teknik kayıtlar.' },
      { heading: 'Paylaşım', body: `Bilgileriniz satılmaz. Barındırma ve e-posta hizmet sağlayıcıları ${pending}.` },
    ],
  },
  {
    slug: 'kullanim-kosullari',
    title: 'Kullanım koşulları',
    sections: [
      { heading: 'Hizmet', body: 'KARAY, emlak ofislerine web sitesi, ilan, müşteri ve marka yönetimi sunan bir yazılım platformudur.' },
      { heading: 'Sözleşme', body: `Platform kullanımı, müşteri ile yapılacak hizmet sözleşmesine tabidir. ${pending}` },
    ],
  },
];

export function findKarayLegal(slug: string): KarayLegalDoc | null {
  return KARAY_LEGAL.find((d) => d.slug === slug) ?? null;
}
