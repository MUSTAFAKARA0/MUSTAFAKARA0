# WP-A2 · Tasarım sözleşmesi (TASLAK, K-22)

> `ecc:architect` (26.10.2026) tasarımı; koordinatör tarafından kaydedildi. **Henüz uygulanmadı.** `ecc:database-reviewer`
> onayı (KI-02) olmadan uygulamaya geçilmez. Bütün SQL `supabase/pending/` altında kalır; canlıya uygulanması ayrı onaydır.

## Bugünkü koddaki üç sorun (canlıda da var) → KI-36

1. **Döndürmede fotoğraf kaybı:** `processMedia` her hata yolunda `markFailed` çağırır, `ready` satırda da
   (`src/app/actions/media.ts` ~215–253); doğrulama hatasında ORİJİNALİ siler (~220, ~230). `stale_media`
   `created_at`'e göre seçtiği için (`20260926000007_v2_security.sql` ~1035) eski bir fotoğrafın başarısız
   döndürmesi sonraki cron'da tamamen silinir. Kural: `ready` satır asla düşürülmez, orijinali silinmez.
2. **Doğrudan silme dosyaları bırakır:** `media_member_write` ile `delete from media_assets` kotayı boşaltır,
   dosyalar depoda kalır ve herkese açık varyantlara erişilebilir; `audit_generic` yalnız `property_id` tutar.
3. **Eşzamanlı iki döndürme dosya sızdırır:** ikisi de eski `public_base`'i okur; ikincisi birincinin varyantlarını öksüz bırakır.

## Bölünme: üç bekleyen dosya

| Dosya | İçerik | Eski kodla |
| --- | --- | --- |
| A `20261027000001_media_finalize_rpc.sql` | `media_finalize`, `media_mark_failed`, `media_file_queue` (RLS açık, politika/yetki yok), AFTER DELETE `media_assets_enqueue_files`, rapor `media_storage_report` | Zararsız (yalnız ekler) |
| B `20261027000002_media_column_privileges.sql` | Sütun yetkileri + BEFORE INSERT `media_assets_pending_shape` | **Bozar** → önce yeni kod |
| C `20261027000003_media_storage_slots.sql` (isteğe bağlı) | `media-originals` için bekleyen satır isteyen depolama politikası | Bağımsız; imzalama davranışı yerelde kanıtlanmadan çıkmaz |

## 1. Sütun yetkileri (B)

Oturum istemcisiyle yapılan `media_assets` yazımları: INSERT (yükleme oluşturma) ve DELETE kalır; `markFailed`,
`processMedia` son güncellemesi ve `retry` RPC'ye taşınır; `sort_order`, `alt_text`, `is_cover` açık kalır
(`set_property_cover`, `reorder_property_media` SECURITY INVOKER).

```sql
revoke update on public.media_assets from authenticated;
grant update (alt_text, sort_order, is_cover) on public.media_assets to authenticated;
revoke insert on public.media_assets from authenticated;
grant insert (id, organization_id, property_id, kind, status, original_path, mime_type, byte_size,
              original_filename, created_by, sort_order, alt_text) on public.media_assets to authenticated;
```

`media_assets_pending_shape` (INVOKER, yalnız `current_user = 'authenticated'`): `status = 'pending'` (sütun
varsayılanı `'ready'`), `original_path` kanonik klasörde ve tek bölüm, `created_by = auth.uid()`; isteğe bağlı kurum
başına bekleyen satır sınırı. `byte_size` eklemede rezervasyon olarak kalır (20261026000001 tetikleyicisi için).

## 2. Sonlandırma RPC'si (A)

`public.media_finalize(p_media uuid, p_expected_base text, p_public_base text, p_variant_widths smallint[],
p_width int, p_height int, p_blur text) returns jsonb` (`previous_base`, `previous_widths`, `byte_size`,
`variants_byte_size`). SECURITY DEFINER, `search_path = ''`, `revoke all from public, anon`, `grant execute to authenticated`.

1. Kilitsiz okuma; satır yok ya da `media.manage`/süper admin değilse `forbidden` (42501), kilit alınmaz.
2. `pg_advisory_xact_lock(hashtextextended('karay.quota:media_assets:' || org, 0))`; satır `FOR UPDATE` ile yeniden okunur.
3. Doğrulama: kanonik klasör `organizations/<org>/properties/<property>/images/<id>` (ilan fotoğrafı) ya da
   `organizations/<org>/content/<id>`; `starts_with`/`left()` (LIKE yok); `p_public_base = klasör || '/' || rev`,
   rev `^[A-Za-z0-9_]{8}(-r(90|180|270))?$`; yeni taban eskisinden farklı; `public_base IS NOT DISTINCT FROM
   p_expected_base` değilse `media_conflict`; genişlikler 1–6 tekil, 1–2880.
4. Gerçek boyut, `(bucket_id, name)` indeksiyle: orijinal tam ad (yoksa `media_not_uploaded`); varyantlar aralık
   koşulu `name >= base || '/' and name < base || '0'` (EXPLAIN ile doğrulanacak); her `base/w<w>.webp` var olmalı
   (yoksa `media_variants_missing`).
5. Kota (satır hariç, gerçek değer, 1,35 payı yok): `ready` değilse `others + new > limit` red; `ready` (döndürme)
   ise yalnız `new > old` ve `others + new > limit` red → `plan_limit_storage`; işlem geri alınır, satır değişmez.
6. Aynı işlemde tek UPDATE (`ready`, boyutlar, sunum alanları, `processed_at`, `error = null`); önceki varyantlar
   kuyruğa; önceki taban kilit altında döner.

`public.media_mark_failed(p_media uuid, p_error text) returns boolean`: aynı izin denetimi, kilit yok; yalnız
`ready` olmayan satırı günceller.

**Uygulama sırası (yeni `processMedia`):** varyantları yükle → hata: yeni varyantları sil + `mark_failed` →
`media_finalize` → hata: yalnız YENİ varyantları sil (ready satır eski hâlinde kalır; yeni yükleme `mark_failed`,
orijinal korunur) → başarı: `previous_base`'i en iyi çabayla sil (kuyruk garanti eder) → satırı yeniden oku.
`ready` satırda asla `remove(original)` ya da `mark_failed` yok.

## 3. Uyumluluk

| Kod \ Şema | yok | A | A+B | A+B+C |
| --- | --- | --- | --- | --- |
| eski (`ff2f7da`) | çalışır | çalışır | **bozuk** (son güncelleme 42501) | bozuk |
| yeni | çalışır (yedek yol) | çalışır | çalışır | çalışır |

- RPC yok algısı: yalnız `err.code === 'PGRST202' && /\bmedia_finalize\b/.test(err.message)`; 42883 asla.
  Her çağrıda denetlenir.
- Geri dönüş: B'den sonra kod geri alınacaksa ÖNCE B'nin 05'i, sonra Instant Rollback. B her zaman A'dan önce geri alınır.
- Kapı (`supabase/ops/media_privileges/` 01): `media_finalize` yoksa DUR; README production dağıtım SHA'sının
  kaydını ve canlıda bir yükleme + döndürme denemesini 03'ten önce şart koşar.
- CI: bekleyen dosyasız (`PENDING=none`) bir E2E ayağı = "yeni kod, eski şema".

## 4. Yetim dosyalar ve kota

Bugün sayılan: her durumdaki satırın `byte_size + variants_byte_size` toplamı (`byte_size` bildirilen). Sayılmayan:
satırsız doğrudan yüklemeler, çöken/başarısız silmelerin varyantları, doğrudan silinen satırların dosyaları,
`branding` kovası. Hedef: `ready` satır gerçek boyutta; `pending`/`failed` bildirilen rezervasyonla (24 saatlik
temizliğe kadar); `branding` plan kotası dışında ama raporda.

Adımlar: (a) A'da silme kuyruğu + AFTER DELETE tetikleyicisi, cron kuyruğu Storage API ile boşaltır;
(b) `stale_media` temizliği `.../{id}/` klasörünün tamamını siler; (c) A'da salt rapor `media_storage_report(p_org)`;
(d) C: satırsız imzalamayı engelleyen depolama politikası (imzalama anında RLS denetimi yerelde test edilmeden çıkmaz).

## 5. Eşzamanlılık

Tek anahtar `'karay.quota:media_assets:'||org`; sıra her zaman danışma kilidi → satır `FOR UPDATE` → depolama
okuma → güncelleme → kuyruk. Yetkisiz çağıran kilitten önce hata alır. `mark_failed` ve silme tetikleyicisi kilit almaz.

## 6. Testler (kabul ölçütleri 1–8)

Yeni dosya `tests/security/media-finalize.test.mjs` (CI'da atlamaz, hata verir). Kimlikler **MF-xx** (SL-07 adı
kilit bekleme testinde kullanılıyor):

| Test | Kanıtlar | Ölçüt |
| --- | --- | --- |
| MF-01 | Bildirilen 1 B, gerçek 2 KB → gerçek boyut yazılır | 1 |
| MF-02 | Başka kurum / kardeş klasör / `/demo` yolu reddedilir; üye olmayan `forbidden`; anon reddedilir | 2 |
| MF-03 | Korunan sütunlara doğrudan güncelleme 42501; `alt_text`, sıralama, kapak çalışır; `status='ready'`/yabancı yol/yabancı `created_by` ekleme reddedilir | 3 |
| MF-04 | Kota hatası satırı değiştirmez; kota üstünde döndürme eski tabanı ve dosyaları korur; eksik varyant reddedilir; `ready` satırda `mark_failed` false | 4 |
| MF-05 | 8 eşzamanlı sonlandırma sınırı aşmaz; yetkisiz sonlandırma başka kurumun kilidini beklemez (SL-07 ile aynı yöntem) | 5 |
| MF-06 | Silme yolları kuyruğa alır; cron boşaltır; rapor satırsız yüklemeyi gösterir; C altında satırsız imzalama reddedilir | 7 |

Ayrıca: SL-06 `addMedia` B'nin koruması için `id` ve kanonik yol gönderecek şekilde güncellenir; birim testi
`tests/unit/media-finalize.test.mjs`; LR-14'e iki yeni runbook; E2E `admin.spec.ts`, `acceptance.spec.ts` iki ayakta;
ölçüt 8: bağımsız DB, güvenlik ve kod incelemesi.

## 7. Dosya sahipliği ve sıra

- **Uygulayıcı 1 (DB):** pending A/B/C, `supabase/ops/media_finalize_rpc/`, `supabase/ops/media_privileges/`,
  `tests/security/media-finalize.test.mjs`, `subscription-limits.test.mjs` (`addMedia`), LR-14, CI matris ayağı.
- **Uygulayıcı 2 (uygulama):** `src/app/actions/media.ts`, yeni `src/modules/media/finalize.ts`,
  `src/modules/media/server.ts`, `src/app/api/cron/media-cleanup/route.ts`, `src/types/supabase.ts`,
  `tests/unit/media-finalize.test.mjs`.
- **Sıra:** 0 sözleşmeyi dondur (imzalar ve hata adları yukarıda) → 1 paralel: A + MF-01/02/04/05 ‖ uygulama +
  yedek yol + birim → 2 B + MF-03 + runbook'lar ‖ cron kuyruğu + klasör temizliği → 3 C + MF-06 (imzalama kanıtından
  sonra) → 4 uyumluluk provası, E2E, bağımsız incelemeler → 5 yayın: A → kod → kapı → B → C (her biri ayrı onay).
