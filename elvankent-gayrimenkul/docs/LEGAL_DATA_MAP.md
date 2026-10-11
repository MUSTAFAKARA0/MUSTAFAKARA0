# Kişisel veri haritası (KVKK) — hukukçu incelemesi için

> Bu belge teknik bir envanterdir; **hukuki görüş değildir.** "Hukukçu kararı" işaretli satırlar bir hukuk danışmanı tarafından değerlendirilmelidir. Sitedeki KVKK, gizlilik, çerez ve kullanım koşulları metinleri taslaktır; panelde "hukuk danışmanı tarafından incelendi" onayı verilene kadar sitede "hukuki danışman tarafından doğrulanmalıdır" uyarısı görünür. Onaysız metinler "hukuken onaylanmış" gibi gösterilmez.

## Veri toplanan noktalar

| # | Nokta | Veri | Amaç | Saklama yeri | Hukuki not |
| --- | --- | --- | --- | --- | --- |
| 1 | İletişim / ilan bilgi / randevu / değerleme formları | ad soyad, telefon ve/veya e-posta, mesaj; randevu zamanı; değerlemede mülk bilgileri | talebe dönüş | Supabase (`customers`, `leads`, `appointments`) | Onay kutusu **aydınlatma metnini okudum** beyanıdır (açık rıza değildir; ayrı tutulmuştur). Onay zamanı `customers.kvkk_consent_at` alanında. **Hukukçu kararı:** metin ve saklama süresi. |
| 2 | Form güvenliği | IP adresinin tuzlu özeti (geri döndürülemez), tarayıcı bilgisi (user-agent) | spam / hız sınırı | `leads.ip_hash`, `leads.user_agent` | Ham IP saklanmaz. |
| 3 | Etkileşim sayaçları | günlük değişen anonim oturum özeti; ilan görüntüleme, tıklama | istatistik | `property_events` | Kişiyi tanımlamaz. |
| 4 | Çerez tercihi, favoriler, karşılaştırma | tercih ve ilan kimlikleri | kullanıcı deneyimi | yalnızca ziyaretçinin tarayıcısı (localStorage) | Sunucuya gönderilmez. |
| 5 | Vercel Web Analytics | sayfa görüntüleme (çerezsiz, kimlik yok) | istatistik | Vercel (ABD/AB) | Yalnızca "analitik" çerez tercihi onaylanırsa yüklenir. |
| 6 | Vercel Speed Insights | sayfa performans ölçümleri (çerezsiz) | performans | Vercel | Onaysız yüklenir (kişisel veri yok). **Hukukçu kararı:** onaya bağlanmalı mı. |
| 7 | Hata izleme (isteğe bağlı Sentry / webhook) | hata mesajı, sayfa yolu; e-posta/telefon maskelenir | hata giderme | Sentry (yurt dışı) | Kişisel veri gönderilmemesi için maskeleme var. |
| 8 | Talep bildirim e-postası (Resend) | varsayılan: kişisel veri **yok** | ofisi haberdar etme | Resend (ABD) | `NOTIFY_EMAIL_DETAILS=full` kişisel veri içerir → **yurt dışına aktarım** (KVKK m.9). **Hukukçu kararı** olmadan açmayın. |
| 9 | Panel kullanıcıları | ad, e-posta, giriş kayıtları, MFA faktörü | yetkilendirme, güvenlik | Supabase Auth, `audit_logs` | Denetim kayıtlarında e-posta maskelenir; 2 yıl saklama. |
| 10 | CRM (ofisin girdiği) | müşteri bilgileri, görüşme notları | hizmet | Supabase | Ofis veri sorumlusudur. **Hukukçu kararı:** saklama/imha politikası. |
| 11 | Barındırma | tüm veriler | hizmet | Supabase (önerilen bölge: Frankfurt), Vercel | Sunucular Türkiye dışında → **yurt dışına aktarım** değerlendirmesi (standart sözleşme / açık rıza / Kurul bildirimi). **Hukukçu kararı.** |
| 12 | Harita | yok (döşemeler sunucu vekilinden) | konum gösterimi | — | Ziyaretçi IP'si harita sağlayıcısına gitmez. |

## Açık rıza gerektirebilecek (şu an YAPILMAYAN) işlemler

- Pazarlama / bülten iletişimi → ayrı, önceden işaretlenmemiş açık rıza kutusu gerekir (şu an yok).
- Yurt dışına aktarımın açık rızaya dayandırılması (hukukçu standart sözleşme yolunu seçebilir).

## Teknik altyapı (hazır)

- Hukuki sayfalar panelden düzenlenir (İçerik › Sayfalar); metin değişince inceleme onayı otomatik kalkar.
- `npm run prelaunch -- --production` hukukçu onayı verilmemiş metinleri kritik hata olarak gösterir.
- Veri dışa aktarma (erişim/taşınabilirlik talepleri): Ayarlar › Veri dışa aktarma.
- Silme: müşteri/talep silme panelden; kalıcı silme ve denetim kaydı mevcut.
