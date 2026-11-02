# KARAYS müşteri yolculuğu — production'da ne çalışır? (K-39, 02.11.2026)

Kaynak: production kodu `a0f0a67` (varsayılan dal) ve canlı şema tespiti (KI-23: 31 migration'dan ilk 21'i uygulanmış,
`20261002000001`'den itibaren 10'u eksik; 8 bekleyen dosya yok). Her akışın çağırdığı veritabanı nesneleri koddan çıkarıldı
(`.rpc('…')` / `.from('…')`) ve her nesnenin hangi migration'da oluşturulduğu eşlendi. Canlıya bağlanılmadı.

| Akış | Durum (canlı şemayla) | Eksik nesne → migration | Gereken |
| --- | --- | --- | --- |
| 1 KARAYS tanıtım + "Bilgi al / Demo talep et" | Sayfa varsayılan bilgilerle açılır; **form gönderimi çalışmaz** ("Talebiniz gönderilemedi"); bildirim e-postası da yok | `submit_platform_lead`, `platform_leads`, `platform_settings`, `public_platform_profile` → **20261002000001** | Migration (O-5a 1. dosya) |
| 2 Yeni emlak ofisi oluşturma | **Yeni e-postalı sahip için çalışmaz**: kod `platform_create_organization(…, p_invite_token_hash)` çağırır; canlıdaki sürüm 5 parametreli (`20260926000007`) → çağrı başarısız, açılan kullanıcı geri silinir. Mevcut bir kullanıcıyla açılış teorik olarak çalışır. Site taslağı/yayını (`site_*`) çalışır; tasarım ailesi izni yalnız uyarı verir | `p_invite_token_hash` sürümü + davet fonksiyonları → **20261008000001**; `platform_set_org_design_families` → 20261004000001; ekip daveti → 20261011000001 | Migration |
| 3 KARAY konsolu: müşteri ve ofis yönetimi | Konsol ana sayfası ve müşteri listesi **hata verir** (`platform_customer_overview`); notlar, aday talepleri ve KARAY ayarları çalışmaz. Durum/plan değiştirme (`platform_set_org_status`, `platform_set_org_plan`) çalışır | → **20261011000001**, 20261002000001 | Migration |
| 3b Ofis paneli CRM (müşteriler, talepler, randevular, koleksiyonlar) | **Çalışır** (tüm nesneler ilk 21 migration'da) | — | — |
| 4 Emlakçı paneline giriş | Mevcut kullanıcılarla e-posta/şifre girişi ve MFA **çalışır**. Şifre sıfırlama çalışır ama **deneme sınırı yok** (kod geri düşer). **Davetle hesap etkinleştirme çalışmaz** → yeni ofis sahibi ilk girişi yapamaz | `invitation_lookup/accept/release` → 20261008000001; `auth_password_reset_allowed` → 20261010000001 | Migration |
| 5 İlan oluşturma ve görsel yükleme | **Çalışır** (ilan, konum, özellikler, medya, kapak, sıralama, kota kontrolü `media_upload_allowed` — hepsi ilk 21'de). Kod bekleyen dosyalara (supabase/pending) bağımlı değil | — | Eşzamanlı kota kilidi ve sunucu tarafı medya sonlandırma bekleyen dosyalarla gelir (O-5 3–4. aşama; ayrı kod yayınıyla) |
| 6 Özel alan adı | **Çalışmaz**: 8 fonksiyonun hepsi eksik. Site oluştururken alan adı yalnız uyarıyla atlanır | `domain_*` → **20261009000001** | Migration + Vercel ortamında `VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID` (var olup olmadıkları buradan görülemez — sahip kontrolü) + müşterinin DNS kaydı |

**Yalnız kod/arayüz gerektiren:** bu akışlarda kod tarafı production'da hazır; engel şema. Yalnız kod işi olarak kalanlar:
(a) şema eksikken kullanıcıya anlaşılır mesaj (ör. "Bu özellik bakımda" — form ve konsol hataları ham "gönderilemedi" diyor),
(b) bekleyen medya dosyaları için ayrı kod yayını (K19 §8 4d–4g). Her ikisi de bu çalışmada YAPILMADI (karar gerekmez ama
öncelik O-5a'nın kendisi: O-5a uygulanınca (a) gereksizleşir).

**Sonuç:** O-5a (9 dosya) KARAYS'ın satış ve müşteri açma akışlarının (1, 2, 3, 4-davet, 6) tamamının ön koşuludur; ofislerin
günlük işleri (3b, 4-giriş, 5) bugün de çalışır.
