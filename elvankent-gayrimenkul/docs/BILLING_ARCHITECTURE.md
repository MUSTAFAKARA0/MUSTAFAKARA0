# Abonelik ve ödeme mimarisi (FAZ 1 — tasarım, kod YOK)

Durum: **ödeme entegrasyonu başlamadı.** İlk müşteriler elle faturalandırılır; plan ve abonelik
durumu KARAY konsolundan atanır. Bu belge sonraki "billing" fazının girdisidir; sağlayıcı kararı
verilmeden kod yazılmaz.

## 1. Bugünkü model (kodda olan)

| Kavram | Nerede | Durum |
| --- | --- | --- |
| Plan | `plans` tablosu: `baslangic`, `profesyonel`, `kurumsal` | Limitler: kullanıcı (3 / 10 / sınırsız), ilan (50 / 300 / sınırsız), depolama (2 / 10 / 50 GB); özellik bayrakları: CRM, analitik, PDF, özel alan adı (yalnızca Kurumsal). `price_monthly` **boş** (fiyat belirlenmedi) |
| Abonelik | `subscriptions` (organizasyon başına geçmişli) | `status`: `trialing`, `active`, `past_due`, `cancelled`, `expired`; `trial_ends_at`, `renewal_at` |
| Plan değişimi | KARAY konsolu › organizasyon › Plan ve abonelik | Mevcut aboneliği kapatır, yenisini açar (geçmiş korunur). Yükseltme / düşürme aynı işlem |
| Limit uygulama | Veritabanı | Kullanıcı ve ilan limiti tetikleyicide (aşılırsa ekleme reddedilir); depolama limiti yükleme başlarken `media_upload_allowed` ile (beyan edilen boyut + varyant payı) |
| Askı | `organizations.status = suspended` | Site 404, panel kapalı, veri korunur — elle |
| Deneme bitişi / gecikme | — | **Otomatik işlem yok.** FAZ 1: müşteri listesinde **Dikkat** ("Deneme süresi bitti", "Ödeme gecikmede", "Aktif abonelik yok") |
| Fatura / ödeme kaydı | — | Yok |

Düşürmede (ör. Kurumsal → Başlangıç) mevcut veri silinmez; limit üstündeki kayıtlar korunur, yeni
ekleme reddedilir. Özel alan adı bayrağı kalkarsa aktif alan adı otomatik kaldırılmaz — billing fazında
karar verilmeli (öneri: uyarı + KARAY onayı).

## 2. Önerilen minimum model

```
Organization 1──* Subscription *──1 Plan
                    │
                    ├── status (trialing | active | past_due | cancelled | expired | suspended*)
                    ├── current_period_start / current_period_end
                    ├── cancel_at_period_end
                    └── billing_provider + provider_customer_id + provider_subscription_id
Subscription 1──* Invoice (provider_invoice_id, amount, currency, status, issued_at, paid_at, e_invoice_ref)
Subscription 1──* PaymentEvent (provider_event_id UNIQUE, type, payload_hash, received_at, processed_at)
```

İlkeler:

- **Tek gerçek kaynak sağlayıcıdır;** uygulama durumu yalnızca imzası doğrulanmış webhook olaylarıyla
  değişir (`PaymentEvent.provider_event_id` tekil → aynı olay iki kez işlenmez).
- Kart verisi KARAY'da **saklanmaz** (sağlayıcının saklı kart / abonelik özelliği; PCI kapsamı dışında kalınır).
- Erişim kararı (`site açık mı, panel açık mı`) yine `organizations.status` + abonelik durumundan
  türetilir; ödeme sağlayıcısına istek anında bağımlılık olmaz.
- Durum geçişleri: `trialing → active` (ilk tahsilat), `active → past_due` (başarısız tahsilat),
  `past_due → active` (yeniden deneme başarılı), `past_due → suspended` (ek süre sonunda; KARAY
  politikası, ör. N gün — karar bekliyor), `* → cancelled` (dönem sonunda), `cancelled → expired`.
- Mevcut `subscriptions` tablosu genişletilir; yeni tablo yalnızca `invoices` ve `payment_events`.
- Sağlayıcı bağımlılığı tek dosyada (`BillingProvider` arayüzü), e-posta ve alan adı adaptörleriyle
  aynı desen.

## 3. Sağlayıcı seçim kriterleri

Aşağıdaki her madde için sağlayıcıdan **yazılı teyit** alınmalı; bu belgede ücret / oran yazılmadı
(uydurma veri yok).

| Kriter | Neden | Soru |
| --- | --- | --- |
| Türkiye'de üye işyeri | KARAY Türkiye'de fatura kesen şirket | Türk şirketi (ltd./a.ş.) olarak doğrudan hesap açılabiliyor mu? TL tahsilat ve TL hesaba ödeme? |
| Kart saklama (tokenizasyon) | Tekrarlayan tahsilat | Kart sağlayıcıda saklanıyor mu, token ile tahsilat var mı? 3D Secure ilk tahsilatta, sonrakilerde? |
| Abonelik / tekrarlayan ödeme | Aylık / yıllık plan | Hazır abonelik ürünü mü var, yoksa tekrarlı tahsilat KARAY tarafında mı zamanlanacak? Deneme süresi, plan değişiminde kıst (proration)? |
| Webhook | Durumun tek kaynağı | Hangi olaylar (başarılı, başarısız, iade, iptal)? İmza doğrulama? Yeniden gönderim? |
| Başarısız ödeme | Gecikme yönetimi | Otomatik yeniden deneme takvimi, kart güncelleme bağlantısı? |
| İade / iptal | Müşteri hakları | Kısmi iade, API ile iade? |
| Fatura | Yasal zorunluluk | Sağlayıcı e-Fatura / e-Arşiv kesiyor mu, yoksa ayrı bir **GİB özel entegratörü** gerekiyor mu? (Ödeme sağlayıcısı ile e-fatura genellikle ayrı hizmettir — teyit edilecek) |
| KVKK | Kişisel veri | Veri Türkiye'de mi işleniyor / yurt dışı aktarım var mı? Veri işleyen sözleşmesi? |
| Komisyon ve ödeme vadesi | Maliyet ve nakit akışı | İşlem başı oran, sabit ücret, hesaba geçiş süresi, abonelik ürünü ek ücreti |
| B2B | Müşteriler şirket | Kurumsal kart, havale/EFT ile ödeme seçeneği, vergi numarası ile fatura |

Değerlendirilecek adaylar (ilk eleme için; özellikleri yukarıdaki sorularla teyit edilmeli):
Türkiye merkezli ödeme kuruluşları (ör. iyzico, PayTR ve bankaların sanal POS'ları) ve uluslararası
sağlayıcılar (ör. Stripe — Türkiye'de kurulu şirketlere doğrudan hizmet verip vermediği teyit edilmeli).

## 4. Billing fazına girmeden önce verilecek kararlar

1. Plan fiyatları ve faturalama dönemi (aylık / yıllık), KDV dahil/hariç gösterim.
2. Deneme süresi uzunluğu ve deneme bitince ne olacağı (otomatik askı mı, KARAY araması mı).
3. Gecikmede ek süre (gün) ve askıya alma politikası.
4. Sağlayıcı ve e-fatura entegratörü seçimi (yukarıdaki tablo doldurulmuş olarak).
5. Düşürmede özel alan adı ve limit aşımı politikası.
