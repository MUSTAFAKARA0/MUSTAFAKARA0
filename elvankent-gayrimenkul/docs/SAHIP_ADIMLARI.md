# Sahibin yapacakları · güncel sıra (02.11.2026, K-50)

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

## Sizin yapacaklarınız (güncel, 02.11 K-50)

Tamamlananlar (02.11): köken sorgusu · KI-24 gerçek prova · gece yedeği · O-5a (9 migration) · KARAYS marka · O-5 Aşama 3
(4 runbook, bayrak KAPALI) · duman testleri · `o5a-uygula` ve `ki23-canli-denetim` ortamlarına onay kuralı · şerit metinleri onayı.

### 1. O-6 geri alma kararı (kod yayınından önce)
Öneri: "O-6: Yayından sonra site/panel açılmazsa ya da girişte hata olursa Vercel'de önceki sürüme dönülür; dönmeyi ben yaparım,
Claude önerir." Yer: Vercel › mustafakara-0-7hh3 › Deployments › en üstteki Production › ⋯ › Instant Rollback (yalnız görün).

### 2. Kod yayını PR'ını birleştirmek
CI yeşil olunca PR linki gelir; birleştirme production dağıtımını başlatır. Sonra duman testi (KARAYS sayfası, konsol, ofis paneli).

### 3. Özel alan adı değişkenleri (ikinci müşteriden önce)
Vercel › Settings › Environment Variables (yalnız Production): `VERCEL_API_TOKEN` (https://vercel.com/account/settings/tokens,
Sensitive), `VERCEL_PROJECT_ID` (Settings › General), takım altındaysa `VERCEL_TEAM_ID`. Değerleri bana göndermeyin.

### 4. İsteğe bağlı: hata bildirimi
`SENTRY_DSN` ya da `ERROR_WEBHOOK_URL` (şu an yok; hatalar yalnız Vercel kayıtlarında).

### 5. Açık kararlar — acelesi yok
- D-04 / D-05 alt kararları (hatırlatma zamanları, salt okunurun kapsamı, saklama süresi — hukukçu görüşü).
- KI-34: D-01…D-03, D-06…D-14, D-16…D-18. Medya aşaması (Aşama 4) kod yayınından sonra ayrı onay.

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
