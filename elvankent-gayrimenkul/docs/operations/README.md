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
