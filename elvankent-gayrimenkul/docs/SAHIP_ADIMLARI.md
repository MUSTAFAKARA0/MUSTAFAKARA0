# Sahibin yapacakları · güncel sıra (02.11.2026, K-40)

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

## Sizin yapacaklarınız (sırayla)

### 1. Köken sorgusu — telefondan, 2 dk (yalnız okur)
O-5a engelinin (İÇERİKSİZ geçmiş) üç koşulundan biri. Dosya küçük (≈ 5 KB), telefonda SQL Editor'ü dondurmaz.
1. https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/blob/claude/karays-mission-control-vn8g65/elvankent-gayrimenkul/supabase/ops/canli_kayit_kokeni.sql
   › "Raw" › tümünü kopyalayın.
2. Supabase › **elvankent-demo** › SQL Editor › New query › yapıştırın › Run.
3. Sonucu CSV olarak (ya da ekran görüntüsüyle) gönderin. İçinde kişisel veri yok (yalnız sürüm numaraları, VAR/YOK, işlem sayıları).

### 2. KI-24 gerçek geri yükleme provası — onay + 3 tıklama
Müşteri verisi GitHub'ın geçici makinesinde, yalnız oradaki yerel veritabanına yüklenir; iş bitince silinir; canlıya dokunulmaz.
1. Bana yazılı onay: **"KI-24 gerçek prova: müşteri verisinin GitHub'ın geçici çalıştırıcısında işlenmesini onaylıyorum."**
2. GitHub › Settings › Secrets and variables › Actions › **Variables** › `RESTORE_DRILL_REAL_DATA_APPROVED` = `true`.
3. `elvankent-gayrimenkul/ops-requests/restore-drill.request` dosyasına (çalışma dalında) bir satır ekleyip "Commit changes".
4. Actions › elvankent-restore-drill › "Review deployments" › Approve.
5. Bitince değişkeni `false` yapın. Ben özetini okurum (BÜTÜNLÜK, Storage 25/25, DENETIM_G, DENETIM_FONKSIYON).

### 3. Vercel kontrolü — 2 dk (yalnız bakın, değiştirmeyin)
Vercel › production projesi › Settings › Environment Variables: **`VERCEL_API_TOKEN`** ve **`VERCEL_PROJECT_ID`** adları var mı?
(Değerleri değil, yalnız "var / yok".) Özel alan adı özelliği bunlar olmadan çalışmaz.

### 4. Gece yedeği — yalnız bilgi
Zamanlanmış koşu GitHub'da 5–6 saat gecikmeli başlıyor (önceki koşular 06:15–07:38 UTC). Ben izliyorum; bir şey yapmanız gerekmez.
Bugün akşama kadar başlamazsa size "Run workflow" (varsayılan dal) ile elle yedek almanızı söyleyeceğim.

### 5. O-5a onayı — 1, 2 ve 4 bitince
Satış ve müşteri açma akışlarını (demo formu, yeni ofis, davet, KARAY konsolu, alan adı) açan 9 migration. Onay cümlesi:
"O-5a: supabase/ops/o5a altındaki 9 dosyanın sırayla canlıya uygulanmasını onaylıyorum." Uygulama yöntemi birlikte seçilecek
(dosyalar 7–44 KB; telefonda SQL Editor zorlanabilir — bilgisayardan ya da ayrı onaylı bir yazma iş akışıyla).

### 6. Açık kararlar — acelesi yok
- D-04 alt kararları: hatırlatma zamanları; 7 gün sonra hangi kısıt.
- D-05 alt kararları: "salt okunur"un kapsamı, askıdaki sitenin görünümü; **saklama/silme süresi (hukukçu görüşü)**.
- KI-34: D-01…D-03, D-06…D-14, D-16…D-18 (karar kaydında).

## Benim yapacaklarım (onay gerektirmeyen)
- Gece yedeğini izlemek ve sonucu yazmak.
- Köken çıktısı ve KI-24 sonucunu okuyup O-5a engelinin kalkıp kalkmadığını raporlamak (KI23 belgesi §2.7).
- O-5a için uygulama yöntemini hazırlamak: telefonda donmayan, onaylı ve geri dönüşü tanımlı bir yol (bilgisayar adımları ya da
  sahip tetiklemeli yazma iş akışı) — taslak, çalıştırılmadan sunulur.
- KALAN_ISLER ve günlüğü güncel tutmak.
