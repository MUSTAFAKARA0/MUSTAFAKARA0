# Telefon kabul testi (gerçek cihaz)

Otomatik testler (Android ve iPhone ekran profilinde, 54 maddelik listenin otomatikleştirilebilen kısmı) geçti. Aşağıda yalnızca **gerçek telefonda** denenmesi gerekenler var. Formlarda gerçek kişi bilgisi kullanmayın (ör. "Test Kişi", `0555 000 00 00`).

Demo: `https://mustafakara-0-7hh3.vercel.app` · Panel: `https://mustafakara-0-7hh3.vercel.app/admin/giris`

Her testte sorun olursa gönderin: **test numarası + ekran görüntüsü + telefon modeli + tarayıcı (Chrome/Safari) + Wi-Fi mi mobil veri mi**.

---

**TEST-01 · Açılış (Android Chrome, mobil veri)**
- URL: `https://mustafakara-0-7hh3.vercel.app`
- Ne yapacağım: Wi-Fi'yi kapatıp sayfayı açın, 3 saniye bekleyin.
- Beklenen: Üstte sarı "DEMO ORTAMI" şeridi; logo; sayfa yana kaymıyor; 3–4 saniye içinde açılıyor.
- Başarısız olursa: ekran görüntüsü + yaklaşık açılma süresi.

**TEST-02 · Açılış (iPhone Safari, Wi-Fi)** — iPhone'a erişiminiz varsa
- URL: aynı
- Ne yapacağım: Safari'de açın, ana sayfayı aşağı kaydırın, menüyü (☰) açıp kapatın.
- Beklenen: Görünüm Android'dekiyle aynı; menü açılıp kapanıyor; en altta alt bilgi (KVKK vb. bağlantılar).
- Başarısız olursa: ekran görüntüsü + iPhone modeli + iOS sürümü.

**TEST-03 · İlanlar**
- URL: `…/satilik` ve `…/kiralik`
- Ne yapacağım: Listeyi kaydırın; "Filtreler"i açıp "3+1" seçin, "Sonuçları göster"; sonra "Temizle".
- Beklenen: Satılıkta 8, kiralıkta 4 "DEMO –" ilan; filtre uygulanıyor ve temizleniyor.
- Başarısız olursa: ekran görüntüsü.

**TEST-04 · Galeri (dokunma hareketleri)**
- URL: herhangi bir ilan
- Ne yapacağım: Fotoğrafı parmakla sağa-sola kaydırın; dokunup tam ekran açın; iki parmakla yakınlaştırın; kapatın.
- Beklenen: Akıcı kayma, tam ekran, yakınlaştırma çalışıyor.
- Başarısız olursa: ekran kaydı (varsa) veya ekran görüntüsü.

**TEST-05 · WhatsApp / Ara / Paylaş**
- Önkoşul: Panel › Şirket ayarları'nda örnek numara (`0555 000 00 00`) girili olmalı.
- Ne yapacağım: İlan sayfasında WhatsApp, Ara ve Paylaş düğmelerine basın (mesajı göndermeyin, aramayı başlatmayın).
- Beklenen: WhatsApp hazır mesajla açılıyor; telefon uygulaması numarayla açılıyor; telefonun paylaş menüsü açılıyor.
- Başarısız olursa: ekran görüntüsü.

**TEST-06 · Form (klavye açıkken)**
- Ne yapacağım: İlan sayfasında "Bilgi al" formunu doldurup gönderin; sonra "Randevu talep et" sekmesini deneyin.
- Beklenen: Klavye açıkken alanlar görünür kalıyor; "Teşekkürler" mesajı.
- Başarısız olursa: ekran görüntüsü (klavye açıkken).

**TEST-07 · Panel girişi ve çıkış**
- URL: `…/admin/giris`
- Ne yapacağım: Önce yanlış şifre, sonra doğru şifreyle girin; sol üst menü (☰) › en altta hesap menüsü › "Çıkış yap".
- Beklenen: Yanlış şifre reddediliyor; giriş sonrası panel; çıkışta giriş sayfasına dönülüyor.
- Başarısız olursa: ekran görüntüsü.

**TEST-08 · Telefondan fotoğraflı ilan**
- Ne yapacağım: Panel › "+" (Yeni ilan) › tip ve başlık › "Taslağı oluştur" › konum › Fotoğraflar adımında **kameradan** 1 ve **galeriden** 2 fotoğraf yükleyin › birini "Kapak fotoğrafı yap" › fiyat, özellikler, açıklama › Yayınlama › "Yayınla". Sonra "Satıldı olarak işaretle".
- Beklenen: Fotoğraflar yükleniyor ve işleniyor; yayınlanan ilan sitede görünüyor; "Satıldı" bandı çıkıyor. Yazdıklarınız adımlar arasında kaybolmuyor.
- Başarısız olursa: hangi adımda + ekran görüntüsü + fotoğraf sayısı ve yaklaşık boyutu. Testten sonra ilanı İlanlar › ⋯ › "Çöpe taşı" ile kaldırın.

**TEST-09 · Talepler (CRM)**
- Ne yapacağım: TEST-06'da gönderdiğiniz talebi Panel › Talepler'de açın, durumunu değiştirip not ekleyin.
- Beklenen: Talep listede, menüde "yeni" rozeti; değişiklik kaydediliyor.

**TEST-10 · İki adımlı doğrulama (MFA)** — aşağıdaki kurulum rehberiyle
- Beklenen: Kurulumdan sonra çıkış/giriş yaptığınızda 6 haneli kod isteniyor.

---

## İki adımlı doğrulama (MFA) kurulumu — kendi hesabınız

Bu işlemi siz yaparsınız; kimse sizin yerinize açamaz.

1. **Uygulama:** Telefonunuza şunlardan birini kurun: **Google Authenticator**, **Microsoft Authenticator** veya parola yöneticinizin doğrulama özelliği (1Password, Bitwarden).
2. **Panel:** `…/admin` › sol menü (☰) › en altta hesap menüsü › **Hesabım** › **İki adımlı doğrulama** bölümü › **Kur**.
3. **Kuruluma başla** düğmesine basın. Ekranda bir QR kod çıkar.
4. Doğrulama uygulamasında **"+" / "Hesap ekle" › "QR kodu tara"** ile bu kodu taratın.
   - Bilgisayardan kuruyorsanız QR'ı telefonla taratın. Telefondan kuruyorsanız **"QR kodunu tarayamıyorum"**a basın, gösterilen anahtarı **Kopyala** ile alıp uygulamada **"Kurulum anahtarı gir / elle gir"** ile yapıştırın.
5. Uygulamada görünen **6 haneli kodu** "Uygulamadaki kod" alanına yazın › **Kurulumu tamamla**.
6. Deneme: Çıkış yapın, tekrar girin. Şifreden sonra kod istenir › kodu girin › **Doğrula ve devam et**.

**Yedekleme (önemli):** Bu sistemde ayrı "yedek kurtarma kodları" **yoktur**. Telefonunuzu kaybetme riskine karşı:
- 4. adımda gösterilen **kurulum anahtarını** (QR'ın yanındaki metin) parola yöneticinize "Elvankent panel MFA anahtarı" başlığıyla kaydedin; yeni telefona aynı anahtarla kurabilirsiniz. Anahtarı ekran görüntüsü olarak galeride, e-postada veya mesajda saklamayın.
- Google Authenticator'da Google hesabı yedeklemesini veya Microsoft Authenticator'da bulut yedeğini açabilirsiniz.
- Son çare: Supabase › Authentication › Users › hesabınız › **MFA factors** › faktörü silin; sonra panelden yeniden kurun (yalnızca Supabase hesabınıza erişen kişi yapabilir).
- Ofis çalışanları için: ofis sahibi Panel › Kullanıcılar › kişi › ⋯ › **İki adımlı doğrulamayı sıfırla**.

Ofis genelinde zorunlu yapmak (isteğe bağlı): Panel › **Kullanıcılar** › **Güvenlik politikası** › "Sahip ve yöneticiler için iki adımlı doğrulama zorunlu" (önce kendi MFA'nızı kurmuş olmalısınız).
