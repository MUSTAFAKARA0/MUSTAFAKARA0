# Yeni müşteri açma (onboarding)

Satış tamamlandıktan sonra KARAY yöneticisinin yaptığı işler. Teknik bilgi gerektiren tek adım
alan adıdır ([domain-connection.md](domain-connection.md)).

## 1. Müşteriyi aç (KARAY konsolu)

İki yol vardır, ikisi aynı çekirdeği kullanır (`provisionOrganization`):

- **Web Siteleri › Yeni site oluştur** (önerilen): firma bilgisi, tasarım ailesi, renkler ve
  isteğe bağlı alan adı tek sihirbazda girilir; ilk sürüm hazırlanır.
- **Organizasyonlar › Yeni organizasyon**: yalnızca hesap; site ayarlarını müşteri kendisi yapar.

Her iki yolda:

- Sahip hesabı **şifresiz ve doğrulanmamış** açılır; geçici şifre yoktur.
- Site **taslak** durumunda açılır: ziyaretçi "Sitemiz çok yakında yayında" sayfasını görür,
  önizleme çalışır. Siteyi açmak teslim adımıdır ([customer-handoff.md](customer-handoff.md)).
  Sihirbazın son adımındaki **"Oluşturduktan sonra siteyi hemen yayına al"** işaretliyse (varsayılan)
  teslim o anda yapılmış olur; müşterinin ilanları ve iletişim bilgileri hazır değilse işareti kaldırın.
- Plan seçilir; abonelik "deneme" durumunda başlar. Deneme bitişi otomatik işlem yapmaz;
  süresi geçince müşteri listede **Dikkat** olarak görünür (ödeme entegrasyonu sonraki fazda).

## 2. Sahip davetini gönder

Organizasyon sayfası › **Sahip hesabı** › *Davet gönder*.

- Bağlantı tek kullanımlıktır, 72 saat geçerlidir; her "tekrar gönder" önceki bağlantıyı geçersiz kılar.
- Davet gönderilmeden müşteri listede **Dikkat: Sahip daveti gönderilmedi** görünür.
- E-posta yapılandırılmamışsa (`EMAIL_PROVIDER`) davet gönderilemez; önce e-postayı kurun
  (docs/OPERATIONS.md §1).

## 3. Müşteri kendi kurulumunu yapar

Sahip giriş yaptığında ofis panelinin ana sayfasında **"Sitenizi kurun"** listesi görünür (yalnızca
sahip ve yönetici rolünde). Adımlar ve ilgili ekranlar:

| Adım | Ekran | Tamam sayılması için |
| --- | --- | --- |
| Firma bilgileri | Marka ve görünüm | Firma adı + telefon veya e-posta |
| Logo | Marka ve görünüm | Logo yüklü |
| İletişim ve adres | Marka ve görünüm | Telefon + il veya açık adres |
| Tasarım | Site › Tasarım | Tema seçili |
| İlk ilan | İlanlar › Yeni ilan | En az bir yayındaki gerçek ilan (demo sayılmaz) |
| Arama motoru (SEO) | Site › SEO | Site başlığı veya açıklaması |
| Değişiklikleri yayınla | Site | Yayınlanmış sürüm var, bekleyen taslak yok |
| Alan adı | Site › Alan adı | Yalnızca planında özel alan adı varsa zorunlu |
| Site yayına açıldı | — | KARAY'ın teslim adımı (zorunlu adımlara sayılmaz) |

Aynı adımlar KARAY konsolunda organizasyon sayfasındaki **Müşteri durumu** panelinde görünür.

## 4. Ekip kullanıcıları

Sahip, **Kullanıcılar › Yeni kullanıcı** ile ekibini ekler. E-posta yapılandırılmışsa kişiye
tek kullanımlık davet gider (geçici şifre yok); listede "Davet bekliyor / gönderilmedi / süresi doldu"
görünür ve *Daveti tekrar gönder* ile yenilenir. E-posta yoksa eski yol: bir kez gösterilen geçici
şifre, ilk girişte değiştirme zorunlu.

## 5. Notlar

Görüşme, destek ve teslim notları organizasyon sayfasındaki **KARAY notları** paneline yazılır.
Notları yalnızca KARAY ekibi görür; düzenlenmez ve silinmez.
