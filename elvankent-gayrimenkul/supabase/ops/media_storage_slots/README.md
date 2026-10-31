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
3. 01 çıktısında `DUR` yok; özellikle **6. satır** (çalıştıran rolün `storage.objects` üzerinde TRIGGER hakkı) `TAMAM`.
4. 02 çıktısı saklandı; tam yedek alındı; bu adım için yazılı O-5 onayı var.

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur (tek SELECT) — C'nin kapısı | `DUR` yok; 4., 5., 6. satırlar `TAMAM`; 8. satır `4 / 0` |
| 2 | `02_save_state.sql` | Okur; dört politikanın ve tetikleyicilerin tanımını kaydeder | Çıktı saklanır (`KAYDET` satırları) |
| 3 | `03_apply.sql` | Tek işlemde uygular (`lock_timeout 3s`, `statement_timeout 30s`) | Sonuç satırı: `media_storage_slot_guard tetikleyici sayısı = 1` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnızca geri dönüş gerekirse; tek işlem | Sonra 01 yeniden: 7., 8., 9. satırlar uygulama öncesi çıktıyla aynı |

## Canlı deneme (04'ten sonra, panelden)

1. Bir ilana fotoğraf yükleyin: `ready` olmalı. 90° döndürün: döndürme çalışmalı (yeni tabana yazılır).
2. Yüklemeyi kesip "Tekrar dene" ile yenileyin (bekleyen satırda `upsert` imzası): tamamlanmalı.
3. Bir şey bozulursa: 05 (aşağıda) ve olay notu.

## Sağlayıcı kısıtı

Tetikleyici `storage.objects` üzerinde kurulur (sahibi `supabase_storage_admin`). Yerelde `postgres` rolünün bu tabloda TRIGGER
hakkı vardır; canlı projede bu hak sağlayıcının storage şeması politikasına bağlıdır ve **bu depodan doğrulanamaz**. 01'in
6. satırı `DUR` derse 03 uygulanmaz (03 de aynı denetimle durur); yalnız politikalı yarım çözüm uygulanmaz, karar sahipte kalır.

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
insert into public.media_overwrite_window (id, open_until) values (true, now() + interval '2 hours')
  on conflict (id) do update set open_until = excluded.open_until;   -- aç
delete from public.media_overwrite_window;                           -- kapat (04'ün 9. satırı açık pencereyi HATA sayar)
```

Pencere yalnız tetikleyiciyi gevşetir; oturum istemcileri politikaya yine takılır. Tabloya istemciler ve `service_role` erişemez.

## Geri dönüş

`05_rollback.sql` tetikleyiciyi, yuva fonksiyonlarını ve bakım penceresi tablosunu siler; dört politikayı
`20260926000008_v2_storage.sql`'deki hâliyle (yalnız kurum klasörü denetimi) yeniden kurar. **C her zaman B'den önce geri alınır**
(B'nin 05'i C varken `DUR: önce C geri alınır` ile durur). Eski koda dönülecekse sıra: C'nin 05'i → B'nin 05'i → Instant Rollback.

Birim testi LR-14 (`tests/unit/launch-readiness.test.mjs`) gövdenin pending dosyayla aynı olduğunu, okuyan betiklerin yazmadığını,
04 gövde özetinin (md5) pending `media_storage_slot_guard` ile eşleştiğini, 05'in geri dönüş ifadelerini ve v2 politikalarını
birebir içerdiğini denetler. Davranış testleri: `tests/security/media-storage-slots.test.mjs`.
