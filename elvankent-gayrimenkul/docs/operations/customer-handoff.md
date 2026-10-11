# Teslim (handoff): siteyi ziyaretçiye açma

Yeni durum alanı yoktur. "Teslim" = KARAY'ın siteyi **taslaktan yayına** alması; müşteri listesindeki
durum bundan sonra **Yayında** olur.

## Ne zaman

KARAY konsolu › Organizasyonlar › filtre **Yayına hazır**: sahip hesabı etkin, zorunlu kurulum
adımları tamam, site ziyaretçiye kapalı. (Genel bakış sayfasındaki "Yayına hazır" kutusu aynı listeyi açar.)

## Kontrol listesi (organizasyon sayfası › Müşteri durumu)

1. Dikkat satırı yok (davet, abonelik, alan adı sorunları çözülmüş).
2. **Önizle** ile site gezildi: firma adı, logo, telefon, WhatsApp, adres doğru; en az bir gerçek ilan
   yayında; demo ilan kalmadı (ofis panelindeki demo uyarısı görünmüyor).
3. Site adresi var ([domain-connection.md](domain-connection.md)); özel alan adı varsa *Aktif*.
4. Bekleyen taslak yok (Kurulum › "Değişiklikleri yayınla" tamam).
5. Yasal sayfalar ve KVKK metni müşteri tarafından onaylandı (docs/GO_LIVE_CONTENT_CHECKLIST.md).

## Yayına alma

KARAY konsolu › Web Siteleri › site › **Site durumu: Yayında** › *Durumu kaydet*. Anında geçerlidir
(önbellek etiketi temizlenir). Kontrol: site adresi açılıyor, "çok yakında" sayfası görünmüyor.

## Teslim sonrası

- Organizasyon sayfası › **KARAY notları**: teslim tarihi, müşteriye verilen bilgiler, açık konular.
- Müşteriye iletilecekler: site adresi, panel adresi (`/admin`), "Şifremi unuttum" akışı, ekip
  kullanıcılarını kendisinin davet edebileceği, destek iletişimi.
- Arama motoru: Search Console'a site haritası (`/sitemap.xml`) — müşterinin alan adı için müşterinin
  hesabıyla veya KARAY'ın doğrulamasıyla.

## Geri alma

Bir sorun çıkarsa site durumu **Bakım modu** (kısa bilgi sayfası) veya **Yayında değil (yakında)**
yapılır; ofis paneli her durumda çalışır. Yayınlanmış bir sürüme dönmek için Site › Geçmiş › *Geri yükle*.
