# Yönetim Paneli Kullanım Kılavuzu

Panel adresi: **`/admin`** (ör. `https://elvankentgayrimenkul.com/admin`). Menüde yalnızca rolünüzün yetkili olduğu bölümler görünür; yetkiler ayrıca veritabanında da denetlenir.

## Giriş ve hesap

- **Giriş:** e-posta ve şifre. Hatalı denemeler güvenlik kaydına yazılır.
- **Şifremi unuttum:** e-postanıza sıfırlama bağlantısı gönderilir.
- **İlk giriş:** yönetici tarafından verilen geçici şifreyle giriş yaptıktan sonra kendi şifrenizi belirlemeniz istenir (en az 10 karakter, harf ve rakam).
- **Hesabım:** ad-soyad ve şifre değişikliği.
- Birden fazla ofise üyeyseniz sol üstteki ofis seçiciden geçiş yapabilirsiniz.

## Panel (Dashboard)

Son 7 / 30 / 90 gün için: ilan sayıları (aktif, taslak, satılan, kiralanan), görüntülenme ve tekil ziyaretçi, favoriler, WhatsApp ve telefon tıklamaları, talepler, talep kaynakları, en çok görüntülenen/favorilenen ilanlar, popüler konumlar, son ilanlar, son talepler ve yaklaşan randevular.

## İlanlar

**Liste:** durum sekmeleri (Taslak, Onay bekleyen, Yayında, Satıldı, Kiralandı, Arşiv, Çöp kutusu), arama (ilan no, başlık), filtreler, sıralama ve toplu işlemler (yayınla, arşivle, öne çıkar, çöpe taşı). Satır menüsünde: düzenle, sitede gör, kopyala, QR kod, PDF broşür.

**Yeni ilan:** ilan türü, emlak tipi ve başlıkla taslak oluşturulur; ardından adım adım sihirbaz açılır. Tüm alanlar **otomatik kaydedilir** (sağ üstte "Kaydedildi" görünür). Aynı ilan başka bir oturumda değiştirilirse üzerine yazılmaz, uyarı gösterilir.

1. **Temel bilgiler:** başlık, fiyat, para birimi, aidat, depozito, pazarlık.
2. **Konum:** il, ilçe, mahalle, açık adres ve haritada nokta. **Konum gösterimi**: *yaklaşık* (önerilen, ~200 m), *yalnızca mahalle* veya *tam konum* (yalnızca mülk sahibinin onayı varsa). Açık adres ziyaretçiye hiçbir zaman gösterilmez.
3. **Özellikler:** m², oda, kat, bina yaşı, ısıtma, otopark, tapu, cephe ve özellik listeleri.
4. **Fotoğraflar:** sürükleyip bırakın veya seçin (JPG, PNG, WEBP, AVIF; iPhone HEIC mümkünse otomatik dönüştürülür). Her dosya en fazla 50 MB, en az 600×400 px; ilan başına 50 fotoğraf. 4K fotoğraflar desteklenir: büyük dosyalar kesintide kaldığı yerden devam eder. Fotoğraflar sunucuda doğrulanır, yönü düzeltilir ve 320–2880 px WebP boyutlarına dönüştürülür; orijinal dosya ve konum (GPS) bilgisi ziyaretçiye gönderilmez. Sıralama sürükle-bırak veya "Öne al / Arkaya al" ile yapılır; menüden kapak seçme, döndürme, açıklama (alt metin) ve değiştirme yapılabilir.
5. **Açıklama:** ilan metni.
6. **SEO:** arama sonucu önizlemesi, SEO başlığı, açıklama, ilan adresi ve paylaşım görseli. Yayındaki ilanın adresi değişirse eski adres otomatik yönlendirilir.
7. **Yayınlama:** eksik alan kontrol listesi, durum geçişleri (yayınla, onaya gönder, satıldı, kiralandı, arşivle), vitrin/ana sayfa seçenekleri, QR kod (PNG/SVG), PDF broşür, performans ve fiyat/işlem geçmişi.

Yayınlamak için en az: başlık (10+ karakter), açıklama (50+ karakter), fiyat, il ve ilçe, bir fotoğraf gerekir. **Editör** rolü yayınlayamaz; "Onaya gönder" ile yetkili kişiye iletir.

**Çöp kutusu:** silinen ilanlar sitede görünmez ve geri yüklenebilir. **Kalıcı silme** geri alınamaz; yayında olmuş ilanın adresi ilgili kategori sayfasına yönlendirilir.

## Müşteri ilişkileri (CRM)

- **Talepler:** web sitesi formları (bilgi, randevu, değerleme, iletişim) ve elle girilen talepler. Durumlar: Yeni › İletişime geçildi › Görüşme › Randevu › Takip › Kapandı / İptal. Sorumlu atama, takip tarihi, not/arama/WhatsApp kaydı ekleme. Talep kaynağı (web sitesi, WhatsApp, telefon, ilan, QR…) raporlarda kullanılır.
- **Müşteriler:** aynı telefon/e-posta ile gelen talepler aynı müşteride birleşir. Müşteri kartında tüm talepler ve randevular görünür.
- **Randevular:** yaklaşan / geçmiş / iptal edilen; onaylama, tamamlama, iptal.
- **Koleksiyonlar (seçkiler):** müşteriye özel ilan seçkisi hazırlayıp tek bir bağlantıyla paylaşın. Bağlantı tahmin edilemez, arama motorlarında listelenmez; süre sınırı verilebilir, istediğiniz zaman iptal edilebilir. Açılma sayısı görünür.
- **Favoriler / Etkileşimler (Analitik):** ilan bazında görüntülenme, WhatsApp, telefon, form, favori ve paylaşım sayıları; talep kaynakları. Kişisel veri toplanmaz; tekil ziyaretçi günlük değişen anonim bir özetle hesaplanır.

## İçerik

- **Medya:** tüm görseller; ilan, tarih, dosya tipi ve boyuta göre filtreleme; kullanılmayan görselleri silme. Depolama kullanımınız plan sınırıyla birlikte görünür.
- **Bölgeler:** il/ilçe/mahalle için rehber sayfaları (giriş metni, rehber, sık sorulan sorular, SEO). Sayfada o bölgedeki yayındaki ilanlar ve ilanlardan hesaplanan fiyat aralıkları otomatik gösterilir. Doğrulayamadığınız iddialar (en iyi, en ucuz vb.) yazmayın.
- **Blog / İçerikler:** blog yazıları (taslak, yayın, ileri tarihli yayın, kapak görseli, SEO; yayın için en az 200 karakter) ve sabit sayfalar (Hakkımızda, Hizmetler, KVKK, Gizlilik, Çerez, Kullanım koşulları). Metinler güvenli Markdown ile yazılır; "Önizleme" sekmesi sitedeki görünümü gösterir. `{{sirket}}`, `{{telefon}}` gibi alanlar şirket bilgileriyle otomatik doldurulur.
  - **Hukuki metinler taslaktır** ve kesin hukuki tavsiye değildir. Bir hukuk danışmanı inceleyip onaylayana kadar sitede "hukuki danışman tarafından doğrulanmalıdır" uyarısı görünür. İnceleme sonrası sayfada "hukuk danışmanı tarafından incelendi" kutusunu işaretleyip kaydedin; metni değiştirirseniz onayı yeniden vermeniz gerekir.
- **SEO:** ana sayfa başlığı ve açıklaması, Google Search Console doğrulama kodu, site paylaşım görseli (1200×630), yönlendirmeler (eski adres → yeni adres; kalıcı veya geçici), site haritası ve robots.txt bağlantıları.

## Yönetim

- **Ayarlar:** ana sayfa başlığı/alt başlığı ve görseli, yeni ilanlarda varsayılan konum gösterimi, plan ve kullanım (kullanıcı, ilan, depolama), **veri dışa aktarma** (ilanlar, müşteriler, talepler — CSV Excel uyumlu veya JSON; dosyalar kişisel veri içerebilir, güvenli saklayın), demo ilanları kaldırma.
- **Şirket Ayarları:** logo, site simgesi, şirket adı, slogan, ticari unvan, tanıtım metni, ana ve vurgu rengi (okunabilirlik otomatik korunur, önizleme gösterilir), telefon, WhatsApp, e-posta, adres, haritadan ofis konumu, çalışma saatleri, sosyal medya.
- **Kullanıcılar:** ekip listesi, yeni kullanıcı ekleme (geçici şifre **yalnızca bir kez** gösterilir; güvenli bir kanaldan iletin), rol değiştirme, devre dışı bırakma, ekipten çıkarma, geçici şifre oluşturma. Sahip rolünü yalnızca bir sahip atayabilir; kimse kendi rolünü değiştiremez; son sahip korunur. Roller ve ayrıntılı yetkileri aynı sayfada listelenir.
- **Güvenlik / Loglar:** kim, ne zaman, hangi kayıtta ne yaptı (giriş/başarısız giriş, yetkisiz deneme, ilan/fiyat/durum değişiklikleri, kullanıcı ve rol değişiklikleri, ayar değişiklikleri, silmeler, dışa aktarmalar). Kayıtlar değiştirilemez; 2 yıl saklanır. Kategori, kişi ve tarihe göre filtrelenir.

## Platform (yalnızca süper admin) — `/platform`

Genel bakış (tüm ofisler, kullanıcılar, ilanlar, depolama), organizasyon oluşturma, askıya alma / yeniden etkinleştirme (askıdaki ofisin sitesi ve paneli kapanır, veriler silinmez), plan ve abonelik durumu değiştirme, özel alan adı ekleme/kaldırma, tüm kullanıcılar ve üyelikleri, plan sınırlarını düzenleme ve sistem kayıtları.

## Sık sorulanlar

- **Fotoğraf yüklenmedi / "başarısız" görünüyor:** dosya bozuk veya desteklenmeyen biçimde olabilir; "Tekrar dene" ya da farklı bir dosya deneyin. Tamamlanmayan yüklemeler 24 saat sonra otomatik temizlenir.
- **"Bu işlem için yetkiniz yok":** rolünüz bu işleme izin vermiyor; ofis yöneticinizden yetki isteyin.
- **"Planınızın limitine ulaşıldı":** ilan, kullanıcı veya depolama sınırı doldu; eski kayıtları temizleyin veya plan yükseltmesi için platform yöneticisiyle görüşün.
- **İlan sitede görünmüyor:** durumunun "Yayında" olduğundan ve çöp kutusunda olmadığından emin olun; değişiklikler genellikle anında, en geç birkaç dakika içinde yansır.
