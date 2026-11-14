# Yeni müşteri açma (onboarding)

Satış tamamlandıktan sonra KARAY yöneticisinin yaptığı işler. Teknik bilgi gerektiren tek adım
alan adıdır ([domain-connection.md](domain-connection.md)).

> **14.11.2026 güncellemesi (pilot):** Aşağıdaki §0, geliştirme dalı `claude/karays-refocus-t84k81` production'a
> çıktıktan ve migration'lar G, H, I canlıda uygulandıktan **sonra** geçerlidir. Bunlardan önce §1–§5 (eski akış) geçerlidir.
> Pilot ofis I uygulanmadan **açılmaz**: I'dan önce açılan her ofis "eski ofis" (legacy) sayılır; ilk kurulum akışı ve
> tasarım kilidi o ofiste çalışmaz. Sıra ve onaylar: [../PILOT_YAYIN_GO_NOGO.md](../PILOT_YAYIN_GO_NOGO.md).

## 0. Pilot ofis açılışı (kod yayını + E/F/G/H/I sonrası)

Ön koşul: [PILOT_YAYIN_GO_NOGO.md](../PILOT_YAYIN_GO_NOGO.md) §5'te G1–G12 tamam; ofisle yazılı pilot sözleşmesi (C2) imzalı.
Her adımın kabul testi CI'da `tests/e2e/pilot-journey.spec.ts` PJ-1…7 ve `pilot-onboarding.spec.ts` PO-1…9 olarak koşar;
aşağıdaki "Kontrol" sütunu canlıda gözle yapılacak olanıdır.

| # | Kim | Ekran / işlem | Kontrol |
|---|---|---|---|
| 1 | KARAY | Konsol › **Organizasyonlar › Yeni**: Organizasyon adı, Kısa ad, İlan no öneki, Sahip adı soyadı, Sahip e-postası › **Organizasyonu oluştur** | "Organizasyon oluşturuldu." Sahip daveti **kendiliğinden** gider (tek kullanımlık, 72 saat, e-postada şifre yok). Gönderim başarısızsa ofis kalır; organizasyon sayfasında **Daveti tekrar gönder** |
| 2 | KARAY | Organizasyon › Plan ve abonelik: plan **Deneme**, **Deneme / pilot bitişi** (1–365 gün; ödeme alınmaz) | Sahip panelinde şerit doğru tarihi gösterir. Pilot bitince otomatik kısıtlama yoktur (OPS-02 kapalı) |
| 3 | KARAY | (İsteğe bağlı) Site › Tema: ofise açık tasarım aileleri daraltılır | Kurulumda yalnız izinli aileler görünür |
| 4 | Ofis sahibi | E-postadaki bağlantı › Yeni şifre (iki kez) › **Hesabımı etkinleştir** | Giriş sonrası panel yerine `/admin/kurulum` açılır |
| 5 | Ofis sahibi | Kurulum: Hoş geldiniz › Ofis bilgileri › **Tasarım** › Önizleme (masaüstü/mobil) › **Tamamla** | Yarıda bırakılırsa kaldığı adımdan devam eder. Önceden işaretli aile "seçim" sayılmaz; sahibin onayı gerekir |
| 6 | Ofis sahibi | Tamamlayınca tasarım ailesi ve tema paketi **kilitlenir**; logo, renk, iletişim, metin, menü, ilan serbest | Site yönetimi › Tasarım kilitli görünür. Değişiklik isteğinde KARAY konsolu › Organizasyon › İlk kurulum › **Tasarım seçimini yeniden aç** (denetim kaydı yazılır) |
| 7 | Ofis sahibi | Marka ve görünüm › **Yasal bilgiler** › Yetki belgesi numarası | Ofis sitesinin alt bilgisinde "Yetki belgesi no: …". Hangi kanalda zorunlu olduğu avukat görüşüne bağlı (D-20) |
| 8 | Ofis sahibi | İlanlar › Yeni ilan (en az 2 fotoğraf) › **Yayınla** | İlan ofis sitesinde açılır; telefondan 6 MB üstü fotoğraf da yüklenir (E canlıda) |
| 9 | Ofis + KARAY | Site › Alan adı › **Alan adı ekle** › DNS kayıtları ofise iletilir › **Doğrula** › **Bağlantıyı kontrol et** ([domain-connection.md](domain-connection.md)) | Durum *Aktif*; HTTPS açılır; ofisin e-postası (MX) etkilenmez |
| 10 | KARAY | Konsol › Web Siteleri › site › **Durumu kaydet** (Yayında) | "Sitemiz çok yakında yayında" sayfası kalkar |
| 11 | Ofis sahibi | Kullanıcılar › **Yeni kullanıcı** (rol: danışman) | Danışmana davet gider; danışman sahip sayfalarını açamaz (F canlıda: başka ofise bağlı hesap eklenemez) |
| 12 | KARAY + ofis | Kendi telefonundan: ofis sitesinde bilgi formu ve randevu talebi | Talep yalnız bu ofisin panelinde görünür; telefonda yatay taşma yok |

Pilot süresince: Sentry e-posta bildirimi ve günlük yedek sonucu izlenir; sorun önem derecesine göre
[incident-response.md](incident-response.md). Ofisten gelen her talep **KARAY notları** paneline yazılır.

## 1. Müşteriyi aç (KARAY konsolu) — eski akış (I canlıda değilken)

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
