# KARAYS · Kalan işler (tek liste)

> 26.10.2026 · son güncelleme `b9d1eab` (ilk sürüm `2f090b2`) (çalışma dalı `claude/karays-mission-control-vn8g65`) · production `ff2f7da`, değişmedi; canlı veritabanına dokunulmadı.
> Kaynaklar: K-19 durum raporu (PDF, 25.10, 12 s.), K-21 bağımsız inceleme (26.10), [K19_YAYIN_HAZIRLIK.md](K19_YAYIN_HAZIRLIK.md), [GELISTIRME_GUNLUGU.md](GELISTIRME_GUNLUGU.md), [K17_KARAYS_RELEASE.md](K17_KARAYS_RELEASE.md), [OPS02_ABONELIK_DURUMLARI.md](OPS02_ABONELIK_DURUMLARI.md), [PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md), [drafts/wpa2/README.md](drafts/wpa2/README.md).
> Liste `ecc:planner` tarafından çıkarıldı, koordinatör tarafından düzeltildi. Her oturum durumu ve kanıtı günceller; kapanan madde yeniden açılmaz.

**Durumlar:** sırada · devam ediyor · doğrulanıyor (kod/test var, kanıt bekleniyor) · hazır-canlıda değil · canlıda doğrulandı · engellendi (teknik / başka iş / erişim-izin / sahip kararı) · kapandı.
**Şimdi:** ✓ = sahip onayı gerekmeden bu dalda yapılabilir.

| Kimlik | Başlık | Kaynak | Durum | Kabul ölçütü | Bağımlılık | Sorumlu uzman | Şimdi | Kanıt |
|---|---|---|---|---|---|---|---|---|
| KI-01 | WP-A2 taslağını ve bulgularını kalıcı TASLAK olarak koru | K-21 §6 | kapandı | `docs/drafts/wpa2/` 3 `.taslak` dosyası + README; CI/ESLint okumuyor | — | koordinatör | — | `2f090b2` |
| KI-02 | WP-A2 tasarımı: sütun düzeyinde UPDATE + tek definer RPC ile sonlandırma | wpa2 README | kapandı (koşullu onay) | Tasarım 11 bulgunun her birini karşılıyor; database-reviewer onaylıyor | KI-01 | ecc:architect, ecc:database-reviewer | — | [drafts/wpa2/TASARIM.md](drafts/wpa2/TASARIM.md) §8 (11 zorunlu değişiklik), §9 dondurulmuş arayüz |
| KI-03 | A2-1: Boyut gerçek dosya bilgisinden | K-21 ölçüt 1 | hazır-canlıda değil | `byte_size`/`variants_byte_size` `storage.objects`'ten; yanlış bildirilen boyut kayda geçmiyor (RLS testi) | KI-02 | ecc:tdd-guide | — | `b9d1eab` · yerel: güvenlik 165/165, E2E 208/0/4 (3 proje), eski şema ve yalnız-A ayakları 28/28; MF-01; L3 gerçek boyut 6/6 |
| KI-04 | A2-2: Başka kurumun yoluyla bilgi okunamaz | ölçüt 2, bulgu #2 | hazır-canlıda değil | Yol `organizations/<kendi kurum>/` ile başlamıyorsa red; kiracılar arası test | KI-02 | ecc:tdd-guide, ecc:security-reviewer | — | `b9d1eab` · yerel: güvenlik 165/165, E2E 208/0/4 (3 proje), eski şema ve yalnız-A ayakları 28/28; MF-02 |
| KI-05 | A2-3: Korunan sütunlara doğrudan UPDATE kapalı | ölçüt 3, bulgu #3/#10 | hazır-canlıda değil | `authenticated` boyut/yol/`status`/`public_base` güncelleyemiyor; kota bu yolla aşılamıyor | KI-02 | ecc:database-reviewer, ecc:tdd-guide | — | `b9d1eab` · yerel: güvenlik 165/165, E2E 208/0/4 (3 proje), eski şema ve yalnız-A ayakları 28/28; MF-03 |
| KI-06 | A2-4: Hatada silinmiş dosyaya işaret eden kayıt kalmaz | ölçüt 4, bulgu #1/#9 | hazır-canlıda değil | RPC/kota hatasında satır `ready` olmuyor; kırık görsel kalmadığı testle gösteriliyor | KI-02 | ecc:tdd-guide, ecc:code-reviewer | — | `b9d1eab` · yerel: güvenlik 165/165, E2E 208/0/4 (3 proje), eski şema ve yalnız-A ayakları 28/28; MF-04, birim karar tablosu |
| KI-07 | A2-5: Eşzamanlı sonlandırma kotayı aşmaz, kurumlar birbirini kilitlemez | ölçüt 5, bulgu #6/#11 | hazır-canlıda değil | N eşzamanlı sonlandırmada toplam kota içinde; farklı kurum beklemiyor; yeni boyut testleri CI'da atlanmıyor | KI-02, KI-14 | ecc:tdd-guide, ecc:e2e-runner | — | `b9d1eab` · yerel: güvenlik 165/165, E2E 208/0/4 (3 proje), eski şema ve yalnız-A ayakları 28/28; MF-05, SL-07, MF-02b |
| KI-08 | A2-6: Eski/yeni kod ↔ şema uyumluluk tablosu | ölçüt 6, bulgu #4 | hazır-canlıda değil | 4 kombinasyon + kod geri dönüşü test ediliyor; runbook "önce kod" sırasını zorluyor | KI-03…KI-06 | ecc:database-reviewer, ecc:e2e-runner | — | `b9d1eab` · yerel: güvenlik 165/165, E2E 208/0/4 (3 proje), eski şema ve yalnız-A ayakları 28/28; MF-07, L2/L3 ayakları |
| KI-09 | A2-7: Kayıtsız/yetim dosya, varyant ve başarısız yüklemelerin kotadaki yeri | ölçüt 7 | hazır-canlıda değil | Her durum için yazılı kural + test; kayıtsız `organizations/{org}/` dosyalarının sayımı tanımlı | KI-02 | ecc:architect, ecc:tdd-guide | — | `b9d1eab` · yerel: güvenlik 165/165, E2E 208/0/4 (3 proje), eski şema ve yalnız-A ayakları 28/28; kuyruk + MQ testleri, L4 cron; satırsız yükleme KI-37 |
| KI-10 | A2-8: Bağımsız incelemeler | ölçüt 8 | kapandı | Kod, veritabanı ve güvenlik incelemesinde açık bloklayan/yüksek bulgu yok; orta bulgular (#5, #7, #8) kapalı | KI-03…KI-09 | ecc:code-reviewer, ecc:database-reviewer, ecc:security-reviewer | — | code-reviewer (bloklayan yok), database-reviewer (koşullu onay, R1/R2 düzeltildi), security-reviewer yeniden inceleme: açık HIGH/CRITICAL yok · `b9d1eab` |
| KI-11 | `media_quota_lock` (20261026000001) runbook'u | K-21 §3, K-19 §8 4b | kapandı | `supabase/ops/media_quota_lock/` 01–05 + README + LR testi; yerelde 01→05→01 sonrası durum ilk hâle eşit | — | ecc:tdd-guide, ecc:database-reviewer | — | `e93d6a7` · yerel prova 4/4 (şimdi 6/6), güvenlik 129/129, SL-07 kırmızı/yeşil |
| KI-12 | `company_name` (20261026000002) runbook'u | K-21 §3, K-19 §8 4c | kapandı | 01 geçersiz satır sayar, 0 değilse DUR; 03 `NOT VALID`, VALIDATE ayrı adım; 04/05 var | — | ecc:tdd-guide, ecc:database-reviewer | — | `e93d6a7` · yerel prova 4/4 (şimdi 6/6), güvenlik 129/129, SL-07 kırmızı/yeşil |
| KI-13 | Runbook provası CI'da tekrar çalıştırılabilir | K-21 "Test kanıtındaki iki sınır" | kapandı | CI her runbook için 01→02→03→04→05→01 + yeniden uygulama çalıştırıyor; hata işi kırmızı yapıyor | KI-11, KI-12 | ecc:tdd-guide, ecc:e2e-runner | — | `e93d6a7` · yerel prova 4/4 (şimdi 6/6), güvenlik 129/129, SL-07 kırmızı/yeşil |
| KI-14 | Davranış testi: yetkisiz istek başka kurumun kilidini beklemez | K-21 §3 | kapandı | Kurum kilidi başka oturumda tutulurken yetkisiz ekleme süre eşiği içinde reddediliyor; kontrol isteği bekliyor | — | ecc:tdd-guide, ecc:security-reviewer | — | `e93d6a7` · yerel prova 4/4 (şimdi 6/6), güvenlik 129/129, SL-07 kırmızı/yeşil |
| KI-15 | `quota_lock` ve `ops02_limits` runbook'ları | PDF s.11 adım 5 | kapandı | 01–05, LR-14, yerel prova | — | — | — | `dc6594a` |
| KI-16 | Bekleyen 4 migration (`20261025000001/2`, `20261026000001/2`) | K-19 §8 4/4b/4c/5 | hazır-canlıda değil | CI'da RLS ve E2E yeşil; canlıya çıkış KI-27 ile | KI-11, KI-12 | ecc:database-reviewer | — | `dd32fa7`, `dc6594a`, CI #94 |
| KI-17 | CI sonucunu doğru commit ile eşleştir | K-21 §6 | kapandı | Her gönderimin koşu numarası ve sonucu günlükte (#93 = `8b2de09`, #94 = `952043c`) | — | koordinatör | — | #99 = `e93d6a7`, #100 = `dc361b9`, #102 = `ebf7607` (WP-A2 `b9d1eab` dahil) yeşil; #101 iptal (yerine #102) |
| KI-18 | ESLint'teki 3 eski uyarı | Günlük K-18 | sırada | `tests/e2e/karay-site.spec.ts:104` kullanılmayan değişkenler giderilmiş; ESLint 0 uyarı | — | ecc:code-reviewer | ✓ | yok |
| KI-19 | P2: `days` dizisine `.max(7)` | Günlük K-18 | kapandı | Gün listesi en fazla 7 öğe ve tekil | — | — | — | `8d0f282` |
| KI-20 | P2: `company_name` için CHECK + zod | Günlük K-18 | kapandı (kod) | zod `4afd83f`; CHECK bekleyen migration, canlıya çıkışı KI-27 | — | — | — | `4afd83f`, `dc6594a` |
| KI-21 | P1: Abonelik durum şeridi + "verilerinizi indirin" | PDF s.11 | sırada | Panelde şerit ve dışa aktarma bağlantısı, E2E testi; metin D-05'e uygun | KI-30 (metin) | ecc:tdd-guide | kısmen | yok |
| KI-22 | P0-1: Canlı yedeğin kanıtı | PDF s.8, K-19 §5 #1 | engellendi (erişim-izin) | Panel Backups ekran görüntüsü (son yedek, PITR) + A4 `sha256sum -c` TAMAM | — | Sahip | — | yok |
| KI-23 | P0-2: Canlı DB kimliği | PDF s.10 | engellendi (erişim-izin) | `karays_brand/01_preflight.sql` çıktısında DUR yok; şema `20261011000001`/`20261018000001` | — | Sahip | — | yok |
| KI-24 | Gerçek yedekle geri yükleme provası | PDF s.7 | engellendi (erişim-izin) | `scripts/restore-drill.sh` gerçek yedekle test sunucusunda (canlıda değil) | KI-22 | Sahip, ecc:e2e-runner | — | betik var |
| KI-25 | O-1 ortam teyidi (Vercel API 403) | K17 §1, PDF s.10 | engellendi (erişim-izin) | Production = `ff2f7da`, Instant Rollback görüldü, `SITE_ENV` ve Root Directory teyitli | — | Sahip | — | yok |
| KI-26 | Yayın A: yalnız güvenlik yaması (O-4) | K-19 §4, §8 birim 1 | engellendi (sahip kararı) | Yayın sonrası sağlık kontrolü geçiyor, production next 16.4.3 | KI-25 | Sahip | — | aday #3, `release/security-only/` |
| KI-27 | Yayın B/C: tam kod + migration'lar (O-5a/b/b'/c, 4c) | K-19 §8 birim 2–5 | engellendi (sahip kararı + erişim) | Her birim kendi runbook'uyla uygulanmış, 04 temiz | KI-22, KI-23, KI-11, KI-12, KI-16 | Sahip | — | yok |
| KI-28 | O-2, O-3 (yedek yöntemi, gece yedeği), O-6 (geri alma yetkisi) | K17 §1 | engellendi (sahip kararı) | Yazılı karar; O-3 seçildiyse iş akışı ilk kez yeşil | — | Sahip | — | yok |
| KI-29 | D-04: Ödeme gecikmesinde ek süre | K-19 §5 #5 | engellendi (sahip kararı) | Yazılı karar (öneri: `past_due` 7 gün) | — | Sahip | — | yok |
| KI-30 | D-05: İptal ve veri saklama (hukuki görüş) | K-19 §5 #6 | engellendi (sahip kararı) | Yazılı karar + sözleşme metni; otomatik silme yok | — | Sahip | — | yok |
| KI-31 | OPS-02 bayrağını açmak (5b) | K-19 §8 | engellendi (başka iş) | Aboneliksiz aktif ofis listesi incelenmiş; bayrak açık ve SL testleri geçiyor | KI-27, KI-29, KI-30 | Sahip | — | yok |
| KI-32 | D-15: CSP jokerini kaldırma + HSTS | K-19 §8 birim 6 | engellendi (erişim-izin + sahip kararı) | Gerçek Supabase'e bağlı önizlemede giriş, büyük yükleme, görsel çalışıyor | — | Sahip, ecc:security-reviewer | — | `e5067fc` (hazırlık) |
| KI-33 | PR #2'yi kapatmak (yanlış hedef dal) | K-19 §5 #8 | engellendi (sahip kararı) | Açıklama yazılarak kapatılmış | — | Sahip | — | yok |
| KI-34 | Diğer açık kararlar: D-01…D-03, D-06…D-14, D-16…D-18 | PHASE2 karar kaydı | engellendi (sahip kararı) | Karar kaydında "Bekliyor" yerine karar (D-16 ile O-4 aynı kararı anlatır) | — | Sahip | — | yok |
| KI-36 | Bugünkü kodda (canlıda da) medya hataları: başarısız döndürme `ready` fotoğrafı `failed` yapıp orijinali silebiliyor; doğrudan silme dosyaları bırakıyor; eşzamanlı döndürme dosya sızdırıyor | TASARIM.md "Bugünkü koddaki üç sorun" | hazır-canlıda değil | `ready` satır hiçbir hata yolunda düşürülmüyor/orijinali silinmiyor (birim + E2E); silme kuyruğu dosyaları kaldırıyor; çakışan döndürmede yalnız kaybedenin yeni varyantları siliniyor | KI-02 | ecc:tdd-guide (uygulama), ecc:code-reviewer | — | `b9d1eab` · yerel: güvenlik 165/165, E2E 208/0/4 (3 proje), eski şema ve yalnız-A ayakları 28/28; birim karar tablosu, L4 cron |
| KI-37 | WP-A2 C: satırsız yükleme ve sonlandırma sonrası nesne üzerine yazmayı engelleyen depolama politikası (+ CI `PENDING` matrisi değerlendirmesi) | K-22 güvenlik M1, DB R3 | sırada | İmzalama anında bekleyen satır isteyen politika yerelde kanıtlanmış (SL testi); satırsız/üzerine yazma yüklemesi reddediliyor; **ölçüt 7 için yayın koşulu** | KI-03…KI-10 | ecc:architect, ecc:database-reviewer, ecc:tdd-guide | ✓ | yok |
| KI-35 | Canlı izleme (P1), canlı Lighthouse/INP (P2) | PDF s.8, s.11 | engellendi (erişim-izin) | Canlı panelde hata/sağlık uçları görülüyor; canlı LCP/INP ölçülmüş | KI-26 | Sahip, ecc:e2e-runner | — | `/api/health` var |

## Şimdi yapılabilir (sahip onayı gerekmez)

1. KI-11, KI-12 runbook'ları; ardından KI-13 (CI provası) ve KI-14 (kilit bekleme testi).
2. KI-02 WP-A2 tasarımı; onaylanınca KI-03…KI-07, KI-09 (TDD, yalnız `pending/` altında), sonra KI-08 ve KI-10.
3. KI-17: her yeni gönderimin CI sonucunu günlüğe yazmak.
4. KI-18: ESLint uyarıları.
5. KI-21: durum şeridinin iskeleti (metin D-05 kararından sonra kesinleşir).

## Sahipten gerekenler

1. P0-1: Supabase › Database › Backups ekran görüntüsü (isteğe bağlı A4 kopyası ve geri yükleme provası).
2. P0-2: `supabase/ops/karays_brand/01_preflight.sql` çıktısı (salt okunur, SQL Editor).
3. O-1: Vercel'de production `ff2f7da`, Instant Rollback, `SITE_ENV` ve Root Directory ekran görüntüsü.
4. O-4: yalnız güvenlik yaması (A) onayı ve yedek kapısının bu yayına uygulanıp uygulanmayacağı.
5. O-5a/b/b'/c ve 4c onayları (sırayla); O-2, O-3, O-6 kararları.
6. D-04, D-05 (hukuki görüşle), D-15 (gerçek ortamda önizleme erişimiyle).
7. PR #2'nin kapatılması.

## PDF ile güncel durum arasındaki farklar

- PDF depolama yarışını "düşük" gösterir; K-20 kotanın doğrudan eklemeyle hiç denetlenmeden aşılabildiğini kanıtladı. Düzeltme `dd32fa7`/`dc6594a`'da bekliyor.
- PDF'teki "kendi ön/son kontrol betikleri" `quota_lock` ve `ops02_limits` için kapandı (`dc6594a`); `media_quota_lock` ve `company_name` için KI-11/KI-12.
- PDF'te olmayan onay birimleri 4b ve 4c K-19 §8'e eklendi.
- PDF'teki P2 "yükleme sonrası kesin denetim" maddesi artık WP-A2'nin içinde (KI-03…KI-09).
- Sayılar eskidi: birim 486 → 505, güvenlik 118 → 128; CI #91 sonradan yeşil oldu, son doğrulanan koşu #94 (`952043c`).
