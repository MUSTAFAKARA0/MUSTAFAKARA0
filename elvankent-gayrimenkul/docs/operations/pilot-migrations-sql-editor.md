# Pilot migration'ları · Supabase SQL Editor ile sahip uygulaması (F → E → G → H → I)

> 22.11.2026 · Kod yayınından (PR #8) **sonra** uygulanır. Canlı veritabanı Claude'un oturumuna bağlı değildir; dosyaları
> sahip yapıştırır, çıktının **ekran görüntüsünü** (değer, e-posta, kişi adı görünmeden) Claude'a iletir; Claude her adımda GO/NO-GO söyler.
> Ayrıntılı kurallar ve geri dönüşler her runbook'un `README.md`'sinde; risk tablosu [../PILOT_YAYIN_GO_NOGO.md](../PILOT_YAYIN_GO_NOGO.md) §4.

## Dosyaları nereden kopyalarım
Her dosya GitHub'da açılır › sağ üstte **Copy raw file** (iki kâğıt simgesi). Kök:
`https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/tree/claude/elvankent-real-estate-platform-vxq9dj/elvankent-gayrimenkul/supabase/ops/`

Supabase › proje › **SQL Editor** › **New query** › yapıştır › **Run**. Her dosya için **yeni sorgu** açın (Editor yalnız son sonucu gösterir).
Sağ üstte doğru projenin seçili olduğunu her seferinde kontrol edin.

## 0. Bir kez, en başta (salt okunur, ~3 dk)
1. `canli_sema_tespiti.sql` → beklenen: satır 1–39 **VAR**, 40–44 **YOK**. Ekran görüntüsünü gönderin.
2. Taze yedek: GitHub › Actions › **elvankent-backup** › Run workflow › Branch: `claude/elvankent-real-estate-platform-vxq9dj` › yeşil bitmesini bekleyin (~5 dk).

## Her migration için aynı 6 adım

| Adım | Dosya | Ne yapar | Devam koşulu |
|---|---|---|---|
| a | `<runbook>/01_preflight.sql` | Yalnız okur | Hiçbir satırda **DUR** yok. Ekran görüntüsünü gönderin, Claude "GO" desin |
| b | `<runbook>/02_save_state.sql` | Yalnız okur; mevcut durumun kaydı | Çıktıyı **Export › CSV** ile saklayın (geri dönüş için) |
| c | `<runbook>/03_apply.sql` | **Yazar** (tek işlem; 3 sn kilit sınırı) | "Success" |
| d | `<runbook>/04_postflight.sql` | Yalnız okur | Tüm satırlar **TAMAM** (I'da **BİLGİ** de olabilir; **HATA** yok) |
| e | Kabul testi (aşağıda) | Panelde | Beklenen sonuç |
| f | Sorun olursa | `<runbook>/05_rollback.sql` | Sonra `01` yeniden; geri alma doğrulanır |

## Sıra ve kabul testleri

| # | Runbook klasörü | Kabul testi (siz, panelde, ~5 dk) | Not |
|---|---|---|---|
| 1 | `tenant_member_guard` (F) | Ekibe yeni bir e-postayla kullanıcı ekleyin → davet gider; kişiyi çıkarıp yeniden ekleyin → eklenir | `01`'in 7. satırındaki çoklu üyelik sayısını ve 8. satırı (0 olmalı) bana söyleyin |
| 2 | `media_size_guard` (E) | Bir ilana telefondan büyük (6 MB üstü) ve küçük bir fotoğraf yükleyin → ikisi de "hazır"; döndür ve sil çalışır | `01` satır 12 **TAMAM** olmalı. Yükleme reddedilirse hemen `05` |
| 3 | `license_no` (G) | Marka ve görünüm › Yasal bilgiler › yetki belgesi no girin → sitenin alt bilgisinde görünür | `05` girilmiş numaraları siler |
| 4 | `pilot_trial_end` (H) | Konsol › organizasyon › Deneme / pilot bitişi alanı görünür (gerçek ofiste denemek gerekmez) | — |
| 5 | `org_setup` (I) | Konsol › Elvankent organizasyonu › "İlk kurulum" kartında "(mevcut ofis — tasarım kilitli değil …)" yazar (I öncesi kart "henüz etkin değil" der); Elvankent paneli normal açılır, kurulum ekranına yönlenmez | Pilot ofis bundan **sonra** açılır |
| 6 | `tenant_hardening` (J, 24.11) | Panel › Talepler › bir talebi açın › "Atanan" alanında bir ekip üyesi seçip kaydedin → kaydedilir; sitenin ana sayfası ve bir ilan sayfası açılır | Kodu içeren PR birleştirildikten **sonra**; tek başına, ayrı bir gün olabilir |

Aynı gün en fazla iki migration önerilir (F + E bir gün, G + H + I başka gün; G ve H çok küçük olduğu için I ile aynı gün olabilir).
Her gün başında 0.2'deki taze yedek yinelenir. Bitince `canli_sema_tespiti.sql` yeniden: satır 1–44 **VAR** (J sonrası 1–45).

> 23.11.2026: F, E, G, H, I canlıda; 24.11.2026: J canlıda (son kontroller TAMAM). Bekleyen migration yok.

## Ne zaman durulur
`01`'de **DUR** · `04`'te **HATA** · kabul testinde beklenmeyen hata · son 24 saatte panelden şikâyet. Durunca o migration'ın `05`'i
uygulanır, bana ekran görüntüsü gönderilir; sonrakine geçilmez.
