# WP-A2 · TASLAK (çalışmayan, uygulanmamış)

> **Bu klasördeki hiçbir dosya çalışan migration, özellik ya da test değildir.** Dosyalar `.taslak`
> uzantılıdır: CI'ın `supabase/pending/*.sql` adımı, birim testleri ve ESLint bunları okumaz.
> İçerik K-21'de (26.10.2026) `ecc:tdd-guide` tarafından yazıldı, incelemede bloklayan ve yüksek
> bulgular çıktığı için `dc6594a`'ya alınmadı. Production `ff2f7da` ve canlı veritabanı etkilenmedi.

## Dosyalar

| Dosya | İçerik |
| --- | --- |
| `20261026000003_media_size_reconcile.sql.taslak` | `media_record_sizes(uuid)` (SECURITY DEFINER) + `media_assets_size_guard` tetikleyicisi |
| `uygulama-ve-testler.diff.taslak` | `src/app/actions/media.ts`, `src/types/supabase.ts`, `tests/security/subscription-limits.test.mjs` değişiklikleri (8b2de09'a göre) |
| `media-size.test.mjs.taslak` | Kaynak düzeyinde birim testleri (MS-01/MS-02) |

## Amaç

Depolama kotası `media_assets.byte_size + variants_byte_size` toplamıdır. `byte_size` istemcinin bildirdiği
boyuttur; `processMedia` gerçek boyutu bilir ama yazmaz. `media_member_write` (FOR ALL) üyenin boyut ve yol
sütunlarını doğrudan değiştirmesine izin verir. Taslak bu iki açığı kapatmayı deniyordu.

## İnceleme bulguları (K-21)

| # | Kaynak | Önem | Bulgu |
| --- | --- | --- | --- |
| 1 | ecc:code-reviewer | BLOKLAYAN | `processMedia` RPC'yi `status='ready'` güncellemesinden SONRA çağırır. Kota dışı bir RPC hatasında yeni varyantlar silinir, satır `ready` kalır ve silinmiş varyantlara işaret eder; `finalizeMediaUpload` `ready` satırı yeniden işlemez → kalıcı kırık görsel. |
| 2 | ecc:database-reviewer H2, ecc:security-reviewer M2 | YÜKSEK | RPC `original_path` / `public_base` değerine güvenir; üye bunları başka kurumun yoluna çevirip o kurumun dosya/varyant boyutunu kendi satırına yazdırabilir (kiracılar arası boyut sızıntısı). |
| 3 | ecc:security-reviewer M1 | YÜKSEK (pratikte) | Üye yol sütunlarını boş/küçük bir nesneye çevirip RPC'yi çağırarak kaydedilen boyutu küçültebilir; yalnızca büyüme denetlendiği için kabul edilir. RPC çağrısı isteğe bağlı olduğu için doğrudan depolama yüklemesi bildirilen boyutta kalır. |
| 4 | ecc:database-reviewer H1 | YÜKSEK | Eski uygulama kodu canlıdayken uygulanırsa koruma tetikleyicisi eski kodun `variants_byte_size` yazımını reddeder → fotoğraf işleme bozulur. "Önce kod" sırası yalnızca yorumdaydı, runbook ile zorlanmıyordu. |
| 5 | ecc:database-reviewer M1 | ORTA | Varyant toplamı `left(name, …)` ile aranır, `(bucket_id, name)` indeksini kullanmaz; her yüklemede kova taranır. `^@` ya da aralık koşulu gerekir. |
| 6 | ecc:database-reviewer M2 | ORTA | Boyutlar danışma kilidinden ÖNCE okunur; büyüme kararı eski değerle verilebilir. |
| 7 | ecc:database-reviewer M3 | ORTA | Varyant listesi boşsa `v_var = 0` iyi bir değerin üzerine yazılır. |
| 8 | ecc:code-reviewer | ORTA | `isMissingRpc` 42883'ü de "RPC yok" sayar; fonksiyon içinden gelen 42883 kota denetimini atlatan eski yola düşürür. Yalnızca PGRST202 + fonksiyon adı eşleşmeli. |
| 9 | ecc:code-reviewer | ORTA | Süreç son güncelleme ile RPC arasında kesilirse boyut hiç eşlenmez (kota eksik sayılır). |
| 10 | ecc:security-reviewer L1 | DÜŞÜK | Üye `status='ready'` yazarak "yeniden işleme" dalını (kota aşımında sessizce devam) tetikleyebilir. |
| 11 | ecc:e2e-runner | Test | SL-06 `variants_byte_size: 0` güncellemesi varsayılan 0'ı değiştirmez; test hatalı (1 olmalı). Boyut testleri CI'da `skip` yerine hata vermeli. |

Yerel doğrulamada (`ecc:e2e-runner`, 1. tur) taslak migration iki kez uygulanabildi, medya E2E 28/28 geçti;
bulgular bunu "hazır" yapmaz.

## Doğru çözümün çerçevesi (tasarlanacak, K-22)

1. `authenticated` için `media_assets` UPDATE yetkisi sütun düzeyinde daraltılır (boyut, yol, durum, `public_base`
   hariç); yalnızca `alt_text`, `sort_order` gibi sunum alanları açık kalır.
2. Sonlandırma tek bir SECURITY DEFINER RPC'de, tek işlemde yapılır: yolların `organizations/<kurum>/` ile başladığı
   doğrulanır, gerçek boyut `storage.objects`'ten okunur, kilit önce alınır, kota denetlenir, `ready` + boyutlar
   birlikte yazılır. Hata olursa satır `ready`'ye geçmez.
3. Eski kod ↔ yeni şema uyumluluk tablosu test edilir; runbook "önce kod" kapısını zorlar.
4. Kaydı olmayan / yetim yüklemeler, varyantlar ve başarısız yüklemelerin kota durumu açıkça ele alınır.
