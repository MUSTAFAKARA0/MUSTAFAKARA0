# Medya depolama yuvaları runbook'u (O-5) — `supabase/pending/20261027000003_media_storage_slots.sql` (WP-A2 · C, KI-37)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır.
Bu betikleri geliştirme ortamı ya da CI çalıştırmaz (CI yalnızca `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder).

**Ne kapatır (K-22 güvenlik M1, DB R3; TASARIM.md §4 d, §10):** ölçüt 7'nin yayın koşulu.
- **Satırsız yükleme:** `media-originals`'a yalnız çağıranın kurumundaki **bekleyen** (`pending`) medya satırının `original_path`'ine
  birebir eşit ada yazılır; `media`'ya yalnız var olan bir satırın klasöründe `<sürüm>/w<genişlik>.webp` adına yazılır.
- **Sonlandırma sonrası üzerine yazma:** `ready` satırın orijinali ve **güncel** varyant tabanı yeniden imzalanamaz, üzerine
  yazılamaz, silinip yeniden yüklenemez. Döndürme yeni tabana yazdığı için çalışmaya devam eder.

**Neden iki katman (yerel ölçüm, storage-api v1.82.1):** Storage, oturum isteğinde ve **imzalama** (`createSignedUploadUrl`)
anında RLS'yi geri alınan bir deneme yazımıyla denetler; imzalı adresle yapılan **asıl yükleme RLS'yi atlar** (veritabanına
`service_role` olarak yazar; token 2 saat geçerli). Bu yüzden politika (imzalama/istek anı) + `storage.objects` üzerinde
`BEFORE INSERT OR UPDATE` tetikleyicisi (`media_storage_slot_guard`; imzalı adresle sonradan yapılan yazım). Kanıt:
`tests/security/media-storage-slots.test.mjs` SL-08…SL-13.

## Zorunlu ön koşullar (03'ten ÖNCE, yazılı kayıt)

1. `../media_finalize_rpc/` (A) ve `../media_privileges/` (B) uygulanmış, 04'leri `TAMAM`. C dosyası B yoksa kendisi `apply B first` ile durur.
2. Yeni kod (`media_finalize` kullanan sürüm) production'da; B'nin README'sindeki yükleme + döndürme denemesi başarılı.
3. 01 çıktısında `DUR` yok; özellikle **6. satır** (çalıştıran rolün `storage.objects` üzerinde TRIGGER hakkı) ve **13. satır**
   (geri alınabilirlik: `storage.objects` sahibi rolüne üyelik ya da supautils `drop_trigger_grants` + `policy_grants` listesinde
   `storage.objects`) `TAMAM`.
4. 02 çıktısı saklandı; tam yedek alındı; bu adım için yazılı O-5 onayı var.

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur (tek SELECT) — C'nin kapısı | `DUR` yok; 4., 5., 6., 13. satırlar `TAMAM`; 8. satır `4 / 0` |
| 2 | `02_save_state.sql` | Okur; dört politikanın ve tetikleyicilerin tanımını kaydeder | Çıktı saklanır (`KAYDET` satırları) |
| 3 | `03_apply.sql` | Tek işlemde uygular (`lock_timeout 3s`, `statement_timeout 30s`) | Sonuç satırı: `media_storage_slot_guard tetikleyici sayısı = 1` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnızca geri dönüş gerekirse; tek işlem | Sonra 01 yeniden: 7., 8., 9. satırlar uygulama öncesi çıktıyla aynı |

## Canlı deneme (04'ten sonra, panelden)

1. Bir ilana fotoğraf yükleyin: `ready` olmalı. 90° döndürün: döndürme çalışmalı (yeni tabana yazılır).
2. Yüklemeyi kesip "Tekrar dene" ile yenileyin (bekleyen satırda `upsert` imzası): tamamlanmalı.
3. Bir şey bozulursa: 05 (aşağıda) ve olay notu.

## Sağlayıcı kısıtı

Tetikleyici ve politikalar `storage.objects` üzerinde kurulur (sahibi `supabase_storage_admin`). `postgres` bu tablonun sahibi
değildir: CREATE TRIGGER için TRIGGER hakkı yeter, ama **DROP TRIGGER ve CREATE/DROP POLICY** (05 ve 03'ün yeniden çalıştırılması)
için Supabase'in supautils ayarları (`supautils.drop_trigger_grants`, `supautils.policy_grants`) `storage.objects`'i bu rol için
listelemelidir. Yerelde (CLI 2.121.0) ikisi de listeliyor; canlı projede **bu depodan doğrulanamaz**. 01'in 6. ya da 13. satırı
`DUR` derse 03 uygulanmaz (03 de aynı denetimlerle durur): ilk uygulama başarılı olup 05'in "must be owner" ile kalması (tetikleyici
kaldırılamaz, B'nin 05'i de C varken durur) bu kapıyla önlenir. Yalnız politikalı yarım çözüm uygulanmaz; karar sahipte kalır.

## Bilinen ve kabul edilen sınırlar (K-23 bağımsız incelemeler)

- **Sayılmayan varyant alanı (güvenlik MEDIUM, sınırlandı):** varyant yuvası her satırda güncel taban dışında en çok 2 tabana ve
  taban başına en çok 6 dosyaya izin verir (kova sınırı dosya başına 10 MB); `media` kovasında üzerine yazma hiç yoktur.
  Bir `media.manage` üyesi kendi kurumunda satır başına bu kadar sayılmayan dosya tutabilir; satır silinince kuyruk yalnız
  orijinal + güncel tabanı alır, ek tabanlar `media_storage_report` ile görünür. Bekleyen D (`media_stray_sweep/`, KI-38) bu
  dosyaları 1 saat sonra listeler, günlük cron siler.
- **İşleme sırasında orijinal (DB LOW #5) → kapatıldı (KI-38):** kurum klasöründeki nesneler **bir kez yazılır**; bakım penceresi
  dışında hiçbir UPDATE (üzerine yazma, taşıma) yok, bekleyen satırda da. Var olan orijinal için upsert imzası imzalama anında
  reddedilir. Yarım kalan yükleme nesne oluşturmaz; yükleme yenilenirken orijinal zaten varsa uygulama yüklemeyi atlar ve işler
  (`renewMediaUpload`, `alreadyUploaded`). Kalan: üye kendi bekleyen orijinalini silip yeniden yükleyebilir (kendi içeriği; kota
  sonlandırmada gerçek boyutla sayılır).
- **Reddedilen yüklemenin dosya baytları (güvenlik LOW):** tetikleyici veritabanı adımında reddeder; storage-api'nin o ana kadar
  yazdığı baytları silip silmediği doğrulanmadı (bütünlüğe etkisi yok, disk kullanımı).
- **TUS (büyük dosya) yolu:** otomatik testte yok; bağımsız güvenlik incelemesi yerelde elle denedi: sonlandırma sonrası eski imzayla
  ve oturumla `x-upsert` TUS yüklemesi reddedildi, bekleyen yuvaya TUS yüklemesi çalıştı.

## Etki

- `authenticated`: `media-originals` INSERT/UPDATE ve `media` INSERT/UPDATE politikalarına yuva şartı eklenir
  (`media_original_slot_open`, `media_variant_slot_open`; SECURITY DEFINER, boş `search_path`, yalnız `authenticated` çağırır).
  SELECT ve DELETE değişmez (üye kendi dosyasını silebilir; silinen `ready` orijinal geri yüklenemez).
- Tetikleyici (yalnız `organizations/` altı, iki kova): sahibi dolu INSERT (kullanıcı oturumu ya da imzalı adres) yuva ister;
  sahibi boş INSERT (`service_role` / sistem, ör. `restore:storage --apply`) serbest; **her UPDATE** (üzerine yazma, taşıma) yuva ister.
- Hata: `media_slot_closed` (42501). Veri ve mevcut dosyalar değişmez.

## Tam geri yükleme sonrası (`restore:storage --apply --overwrite`)

C, `service_role`'ün de sonlanmış nesnelerin üzerine yazmasını engeller. Tam geri yüklemeden sonra (nesne kayıtları var, dosyalar
eksik) üzerine yazma gerekiyorsa, **hedef** projenin SQL Editor'ünde en çok 24 saatlik bakım penceresi açılır, iş bitince kapatılır:

```sql
insert into public.media_overwrite_window (id, opened_at, open_until) values (true, now(), now() + interval '2 hours')
  on conflict (id) do update set opened_at = excluded.opened_at, open_until = excluded.open_until;   -- aç (CHECK: en çok 24 saat)
delete from public.media_overwrite_window;                           -- kapat (04'ün 9. satırı açık pencereyi HATA sayar)
```

Pencere yalnız tetikleyiciyi gevşetir; oturum istemcileri politikaya yine takılır. Tabloya istemciler ve `service_role` erişemez.
Pencere açıkken imzalı adresler de serbest yazar: geri yükleme bitene kadar ofis kullanıcılarının yükleme yapmaması (bakım
duyurusu) sağlanır ve pencere iş biter bitmez kapatılır.

## Geri dönüş

`05_rollback.sql` tetikleyiciyi, yuva fonksiyonlarını ve bakım penceresi tablosunu siler; dört politikayı
`20260926000008_v2_storage.sql`'deki hâliyle (yalnız kurum klasörü denetimi) yeniden kurar. **C her zaman B'den önce geri alınır**
(B'nin 05'i C varken `DUR: önce C geri alınır` ile durur). Eski koda dönülecekse sıra: C'nin 05'i → B'nin 05'i → Instant Rollback.

Birim testi LR-14 (`tests/unit/launch-readiness.test.mjs`) gövdenin pending dosyayla aynı olduğunu, okuyan betiklerin yazmadığını,
04 gövde özetinin (md5) pending `media_storage_slot_guard` ile eşleştiğini, 05'in geri dönüş ifadelerini ve v2 politikalarını
birebir içerdiğini denetler. Davranış testleri: `tests/security/media-storage-slots.test.mjs`.
