# Sahibin yapacakları · güncel sıra (02.11.2026, K-54)

> Değerleri (anahtar, şifre, bağlantı adresi) **kimseye yazmayın**, bana da göndermeyin. Bana "tamam", çıktı özeti ya da değer
> görünmeyen ekran görüntüsü yeter. Önceki sürüm (31.10) git geçmişinde; oradaki A bölümü (gece yedeği kurulumu) ve O-4 / PR #3
> yayınları tamamlandı.

## Tamamlananlar (kanıtıyla)

| İş | Kanıt |
| --- | --- |
| Gece yedeği kurulumu (sırlar, R2 kovası, değişkenler) | Elle yedek #47 ve #48 başarılı (varsayılan daldan #48, 01.11) |
| O-4 güvenlik yaması + KARAY-01 + PR #3 yayını | Production `a0f0a67` (01.11) |
| D-04 / D-05 ana kararları | Karar kaydı 01.11 (alt kararlar aşağıda açık) |
| KI-23 canlı şema tespiti | 21 migration var, 10 eksik (CSV, 01.11) |
| KI-23 canlı şema ve güvenlik denetimi | Actions #8 (02.11): G1–G4 TAMAM; 751 nesne AYNI; 77 fonksiyonun farkı **yalnız satır sonu biçimi** (başlık 77/77, CR'siz gövde 77/77 AYNI) → "TAMAM (biçim farkı)" |
| KI-24 hazırlığı | R2 okuma anahtarı (`RESTORE_S3_*`) ve `restore-drill` ortam onayı tanımlandı |
| PR #2 | Kapalı |

## Sizin yapacaklarınız (güncel, 02.11 K-54)

Tamamlananlar (02.11): köken sorgusu · KI-24 gerçek prova · gece yedeği · O-5a (9 migration) · KARAYS marka · O-5 Aşama 3 · duman testleri · `o5a-uygula` ve `ki23-canli-denetim` onay kuralı · şerit metinleri · O-6 kararı · Vercel takım erişimi · tam kod yayını (PR #4) · Mission Control ajan düzeltmesi (MC PR #4)

### 1. ✓ O-6 kararı verildi (02.11): Claude söyler, siz onaylarsınız, Claude Vercel'de önceki sürüme döner

### 2. ✓ Kod yayını PR #4 birleştirildi (02.11, production `6b698e9`, duman testi geçti)

### 3. ✓ Hata bildirimi (Sentry) bağlandı (02.11) — deneme olayı sonra (sahip kararı)
sentry.io (AB veri bölgesi) › Next.js projesi `karays` › DSN › Vercel › Settings › Environment Variables › `SENTRY_DSN` (Production) ›
Redeploy. Bana "eklendi" yazın; deneme hatasıyla e-postayı birlikte doğrularız.

### 4. ✓ Mission Control PR #5 birleştirildi (02.11) — APK #13'ü kurun
https://github.com/MUSTAFAKARA0/ecc-mission-control/pull/5 (pano: Yapılanlar / Yapılacaklar / Sahibin yapacakları; Bugün ne oldu; Oturum karnesi).

### 5. ✓ Aşama 4 (medya) uygulandı ve duman testi geçti (02.11)
Önce yeni kodla bir ilanda fotoğraf yükleme + döndürme + silme denemesi; sonra onay cümlesi (iş akışı `elvankent-o5c-uygula`, hazır).

### 6. Özel alan adı — önce müşteriyle görüşün (alan adı ve DNS müşterinin)
Vercel'e `www.elvankentgayrimenkul.com` eklemek + `VERCEL_API_TOKEN` (1 yıl), `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` (Production).

### 7. Açık kararlar — araştırma paketi hazır
[KARAR_ARASTIRMA_PAKETI.md](KARAR_ARASTIRMA_PAKETI.md): her karar için seçenek, öneri, kaynak ve avukat/mali müşavir soruları.
En acil: D-11 (Supabase/Vercel ücretli plan: Vercel Hobby ticari kullanıma kapalı; Supabase Free'de platform yedeği yok).

## Benim yapacaklarım (onay gerektirmeyen)
- Gece yedeğini izlemek ve sonucu yazmak.
- Köken çıktısı ve KI-24 sonucunu okuyup O-5a engelinin kalkıp kalkmadığını raporlamak (KI23 belgesi §2.7).
- O-5a için uygulama yöntemini hazırlamak: telefonda donmayan, onaylı ve geri dönüşü tanımlı bir yol (bilgisayar adımları ya da
  sahip tetiklemeli yazma iş akışı) — taslak, çalıştırılmadan sunulur.
- KALAN_ISLER ve günlüğü güncel tutmak.

## O-5a çalıştırma (onay verildi; iş akışı CI'dan geçince)

1. Taze yedek (son 3 saat içinde olmalı; yedek **bitip yeşil olmadan** O-5a'yı tetiklemeyin): https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/workflows/elvankent-backup.yml
   › Run workflow (varsayılan dal) › yeşil olmasını bekleyin.
2. İstek dosyası: https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/edit/claude/karays-mission-control-vn8g65/elvankent-gayrimenkul/ops-requests/o5a-uygula.request
   › son satırı tam olarak `CALISTIR=evet` yapın › Commit changes.
3. https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/workflows/elvankent-o5a-uygula.yml › en üstteki çalışma › Review deployments › Approve.
4. Sonuç "SONUÇ: TAMAM" olmalı; bana iletin. Ardından satırı yeniden `# CALISTIR=evet` yapıp kaydedin.
5. Duman testi (tarayıcıdan): KARAYS sayfasında "Bilgi al" formuyla kendinize bir deneme talebi → KARAY konsolu › Talepler; konsol
   ana sayfası ve Müşteriler listesi açılıyor mu; bir kiracı sitesi ve ofis paneli açılıyor mu.
