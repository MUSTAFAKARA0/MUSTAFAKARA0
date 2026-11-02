# Sahibin yapacakları · güncel sıra (02.11.2026, K-59)

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

## Sizin yapacaklarınız (güncel, 02.11 K-59)

Tamamlananlar (02.11): O-5 Aşama 1–4 canlıda ve doğrulandı · tam kod (PR #4) ve tanıtım videosu (PR #5) yayında · Sentry bağlandı ·
`VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` tanımlandı · onay kuralları · O-6 · D-13 (müşteri siteleri kendi alan adlarıyla) ·
Mission Control PR #4/#5 ve APK #13

### 1. KARAYS'in kendi alan adı (en önemli; e-posta buna bağlı)
Örn. `karays.com.tr` — https://www.isimtescil.net veya https://www.natro.com. Alınan adı Claude'a yazın.

### 2. E-posta gönderimi (alan adından sonra) — şu an davet, şifre sıfırlama ve talep e-postaları GİTMİYOR
https://resend.com/signup › Domains › Add Domain (Ireland) › DNS kayıtları › API Key (Sending access) › Vercel Production:
`RESEND_API_KEY` (Secret), `EMAIL_FROM` = `KARAYS <bildirim@alan-adi>`, `EMAIL_PROVIDER` = `resend`.

### 3. Elvankent alan adı — önce müşteriyle görüşün
Onay sonrası konsol › Web Siteleri › Elvankent › Domain ekranındaki DNS kayıtları müşteriye iletilir.

### 4. Altyapı planları (D-11, ücretli; karar sahipte)
Vercel Pro (Hobby ticari kullanıma kapalı) · Supabase Pro (günlük platform yedeği). Fiyatları sayfada teyit edin.

### 5. Avukat ve mali müşavir — [KARAR_ARASTIRMA_PAKETI.md](KARAR_ARASTIRMA_PAKETI.md) soru listesi

### 6. Sonraya bırakılanlar
Sentry deneme olayı · tanıtım videosu Türkçe seslendirmesi ([metin](KARAYS_TANITIM_SESLENDIRME.md)).

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
