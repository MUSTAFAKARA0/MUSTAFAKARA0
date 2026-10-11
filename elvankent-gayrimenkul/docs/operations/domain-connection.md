# Site adresi ve alan adı bağlama

Karar (FAZ 0, korunuyor): ilk 10–20 müşteride alan adları barındırmaya (Vercel › Domains) **elle**
eklenir; Vercel API otomasyonu sonraki faz. Ortam değişkenleri: docs/OPERATIONS.md §5 ve
docs/DEPLOYMENT_RUNBOOK.md.

## Her sitenin bir adresi olmalı

Bir ofisin sitesi (ve önizlemesi) yalnızca **kendi adresinde** açılır:

| Adres | Ne zaman | Gerekli |
| --- | --- | --- |
| `{kısa-ad}.{PLATFORM_ROOT_DOMAIN}` | Her plan (Başlangıç ve Profesyonel'de tek seçenek) | `PLATFORM_ROOT_DOMAIN` tanımlı + alt alan adı barındırmaya eklenmiş |
| Müşterinin kendi alan adı | Planında özel alan adı varsa (Kurumsal) | TXT doğrulaması + yönlendirme (aşağıda) |

`PLATFORM_ROOT_DOMAIN` tanımlı değilse ve ofisin aktif alan adı yoksa sitenin **adresi yoktur**:

- KARAY konsolunda "Siteyi aç" bağlantısı gösterilmez, Web Siteleri listesinde **Adres yok** yazar.
- "Önizle" açık bir hatayla durur ("Bu sitenin henüz bir adresi yok…").
- Canlıya çıkış kontrolü (`npm run prelaunch -- --production`) bu durumda **hata** verir.

(FAZ 1 öncesinde bu durumda bağlantılar varsayılan kiracının — başka bir müşterinin — adresine gidiyordu.)

## A) KARAY alt alan adı (`ofis.karay-kok-alan-adi`)

1. Bir kez: `PLATFORM_ROOT_DOMAIN` değerini production ortamına girin; kök alan adının DNS'inde
   `*.{kök}` için barındırmanın verdiği kaydı oluşturun (veya her alt alan adını tek tek ekleyin).
2. Her müşteri için: barındırma panelinde (Vercel › Project › Domains) `{kısa-ad}.{kök}` ekleyin.
   Joker (`*.{kök}`) alan adı eklendiyse bu adım gerekmez; joker sertifika için barındırmanın
   şartlarını (ör. alan adının ad sunucuları) kontrol edin.
3. Kontrol: `https://{kısa-ad}.{kök}/` açılıyor (site taslaksa "çok yakında" sayfası), KARAY
   konsolundaki "Önizle" çalışıyor.

## B) Müşterinin kendi alan adı

Ofis paneli › Site › Alan adı (veya KARAY konsolu › Web Siteleri › site › Alan adı):

1. **Ekle** → durum *Bekliyor*; site bu adreste henüz açılmaz.
2. Gösterilen **TXT** kaydını müşterinin DNS'ine ekleyin → **Doğrula** → *Doğrulandı*.
3. Alan adını barındırmaya ekleyin (Vercel › Domains) ve gösterilen **CNAME** (alt alan) veya **A**
   (kök alan) kaydını DNS'e girin → **Bağlantıyı kontrol et** → *Aktif*. İlk aktif alan adı birincil olur.
4. Supabase › Auth › Redirect URLs listesine `https://ALANADI/admin/auth/callback` ekleyin.

Hedef kayıt yapılandırılmamışsa (`DOMAIN_TARGET_CNAME` / `DOMAIN_TARGET_A` yok) yalnızca süper admin,
barındırmada kontrol ettikten sonra elle onaylayabilir.

## Takılan alan adı

Alan adı **3 günden uzun** *Bekliyor / Doğrulandı* durumunda kalırsa müşteri listede **Dikkat**
olarak görünür. Sık nedenler: TXT kaydı yanlış ada eklenmiş (`_karay-verification.ALANADI`), DNS
yayılması sürüyor (48 saate kadar), CNAME yerine yönlendirme (URL forwarding) kullanılmış, kök alan
adında CNAME yerine A kaydı gerekli. Doğrulama kodunun süresi dolduysa **Yeni kod oluştur** ile yenileyin.
