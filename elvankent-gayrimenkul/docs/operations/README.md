# Operasyon belgeleri (KARAY ekibi)

İlk 10–20 müşteri için elle yürütülen işler. Her belge tek bir işi anlatır; ortam değişkenleri,
migration ve dağıtım ayrıntıları kopyalanmaz, ilgili ana belgeye bağlantı verilir.

| Belge | Ne zaman |
| --- | --- |
| [customer-onboarding.md](customer-onboarding.md) | Satıştan sonra yeni müşteri (emlak ofisi) açarken |
| [domain-connection.md](domain-connection.md) | Müşterinin sitesine adres verirken (KARAY alt alan adı veya kendi alan adı) |
| [customer-handoff.md](customer-handoff.md) | Kurulum bitince siteyi ziyaretçiye açıp müşteriye teslim ederken |
| [incident-response.md](incident-response.md) | Site / panel / e-posta / alan adı sorunu, şüpheli erişim; izleme ve eşikler |
| [backup-restore.md](backup-restore.md) | Yedek, geri yükleme, tek müşteri verisinin kurtarılması |

Müşteri durumu (KARAY konsolu › Organizasyonlar) mevcut kayıtlardan hesaplanır, ayrı bir durum alanı yoktur:

| Durum | Anlamı | KARAY ne yapar |
| --- | --- | --- |
| Davet bekliyor | Sahip hesabını henüz etkinleştirmedi | Gerekirse daveti tekrar gönder, müşteriyi ara |
| Kurulumda | Sahip giriş yaptı; kurulum adımları eksik | Müşteriye destek; adımlar organizasyon sayfasında |
| Yayına hazır | Zorunlu adımlar tamam, site ziyaretçiye kapalı | [Teslim](customer-handoff.md) |
| Yayında | Site açık ve yayınlanmış | Rutin takip |
| Dikkat | Süresi dolan / gönderilmemiş davet, ödeme gecikmesi, deneme bitti, abonelik yok, 3 günden uzun bekleyen alan adı | Nedeni satırda yazar; çöz |
| Askıda | Organizasyon askıda veya kapatılmış | — |

## Ödeme gecikmesi ve iptal (sahip kararları D-04 / D-05, 01.11.2026)

Kararlar ve açık noktalar: [OPS02_ABONELIK_DURUMLARI.md §5](../OPS02_ABONELIK_DURUMLARI.md). **Hiçbir aşamada otomatik veri silme yoktur.**

**Önemli (canlı kod, OPS-02 bayrağı canlıda yok):** Abonelik KARAY konsolunda **"iptal" ya da "sona erdi" yapılmaz** (konsol zaten
seçtirmez; doğrudan SQL ile de yapılmaz). Aboneliği bu durumlara geçen ofisin kullanıcı, ilan ve depolama limitleri kalkar (sınırsız
olur). Bu kural, OPS-02 dosyaları canlıya alınıp bayrak sahibin kararıyla açılana kadar geçerlidir.

### Ödeme gecikmesi (D-04)
1. Ödeme gecikince abonelik durumunu konsoldan **Ödeme gecikmiş** (`past_due`) yapın; tarihi KARAY notuna yazın. Site ve panel çalışmaya
   devam eder (kararın gereği).
2. **7 takvim günü** ek süre. Bu sürede hatırlatma yapın — sayı, gün/saat ve kanal **henüz kararlaştırılmadı** (açık karar); karar verilene
   kadar elle ve KARAY notuna kayıtla.
3. Ödeme gelirse durumu **Aktif** yapın.
4. 7 gün sonunda kısıtlama **uygulanabilir**; türü (bakım modu, yeni kayıt engeli, askı) ve zamanı **açık karar**. Karar verilene kadar
   KARAY durumu sahibe bildirir, sahibin yazılı talimatıyla uygular. Veri silinmez.

### İptal (D-05)
1. Müşteri iptal bildirince **ödenmiş dönemin sonuna kadar hiçbir şey değiştirmeyin** (tam erişim). İptal ve dönem sonu tarihini KARAY
   notuna yazın (konsol `cancelled_at` alanını doldurmaz).
2. Dönem sonundan itibaren **14 gün salt okunur** süre. Canlıda bu teknik olarak zorlanamaz (OPS-02 bayrağı yok; aboneliği "iptal" yapmak
   limitleri kaldırır). Geçici uygulama: abonelik **Aktif** bırakılır (müşteri lehine), müşteriden yeni kayıt girmemesi ve verisini
   **dışa aktarması** istenir. Bu geçici uygulama sahibin onayına sunuldu (OPS02 §5.3 #3); "salt okunur"un kapsamı açık karar.
3. Dışa aktarma: ofis panelinden ilanlar, müşteriler ve talepler. Görseller dahil değildir (talep üzerine elle; yöntem açık karar).
4. 14 günün sonunda organizasyonu KARAY konsolundan **Askıya al**. Site ve panel kapanır, **veri silinmez**. Plan ve abonelik olduğu gibi
   bırakılır. Tarihi KARAY notuna yazın.
5. Askıdaki verinin saklama süresi ve nihai silme **hukuki değerlendirmeye bağlı** (D-10); silme yalnız sahibin yazılı talimatıyla, elle ve
   kayıtla yapılır.
