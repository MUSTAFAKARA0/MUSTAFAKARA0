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

## Müşteri ayrılırsa: geçici kural (OPS-02)

Abonelik KARAY konsolunda **"iptal" ya da "sona erdi" yapılmaz.** Bugünkü kodda aboneliği bu durumlardan
birine geçen ofisin kullanıcı, ilan ve depolama limitleri kalkar (sınırsız olur), site ise açık kalır
([PHASE2_PRODUCTION_PREFLIGHT.md › OPS-02](../PHASE2_PRODUCTION_PREFLIGHT.md)). Bunun yerine:

1. Müşteri verisini almak istiyorsa, askıdan **önce** ofis panelinden dışa aktarmasını isteyin. Dışa
   aktarım ilanları, müşterileri ve talepleri kapsar, görseller dahil değildir. Askıdan sonra panel kapanır.
2. Organizasyonu KARAY konsolundan **Askıya al**. Site ve panel kapanır, veri silinmez. Plan ve abonelik
   olduğu gibi bırakılır.
3. Ayrılış tarihini ve nedenini organizasyon sayfasındaki **KARAY notları**na yazın.

Kalıcı çözüm, yani aboneliği olmayan ofiste yeni ilan, üye ve yüklemenin reddedilmesi, ile veri saklama
süresi D-05 kararına bağlıdır ([PHASE2_DECISION_REGISTER.md](../PHASE2_DECISION_REGISTER.md)). O karar
verilene kadar bu kural geçerlidir.
