# Medya sütun yetkileri runbook'u (O-5) — `supabase/pending/20261027000002_media_column_privileges.sql` (WP-A2 · B)

Bekleyen migration'ı canlıda **tek başına** uygulayan betikler. Yalnızca **sahip** (O-5), **yazılı onaydan sonra** çalıştırır.
Bu betikleri geliştirme ortamı ya da CI çalıştırmaz (CI yalnızca `scripts/rehearse-runbooks.sh` ile yerel veritabanında prova eder).

**ESKİ KODU BOZAR.** B sonrası eski uygulama kodunun `media_assets` güncellemeleri (`markFailed`, son `ready` güncellemesi, yeniden deneme)
`42501` alır ve eski kodun kanonik olmayan yolla eklemesi `media_invalid_input` ile reddedilir. Bu yüzden sıra zorunludur:
**A → yeni kod production'da → kapı (01) → B.**

## Zorunlu ön koşullar (03'ten ÖNCE, yazılı kayıt)

1. `../media_finalize_rpc/` (A) uygulanmış ve 04'ü `TAMAM`. B dosyası A yoksa kendisi `apply A first` ile durur; 01 de `DUR` verir.
2. **Production dağıtım SHA'sı kaydedildi** ve yeni kod (`media_finalize` kullanan sürüm) bu SHA'dan itibaren canlıdır. Eski kod hâlâ canlıdaysa
   (ör. Instant Rollback ile eski dağıtım) B UYGULANMAZ. SHA'yı ve dağıtım zamanını kayda geçirin.
3. **Canlıda bir yükleme + döndürme denemesi başarılı** (A'nın üzerinde, B'den önce): bir fotoğraf yükleyin, `ready` olduğunu görün, 90° döndürün.
   Bu deneme depolama erişimini (fonksiyon sahibi `storage.objects` okur ve RLS'yi atlar) gerçek ortamda kanıtlar; 01'in 5. satırı yalnız hak/rol bayrağını görür.
4. 01'in 12. satırı (kurum önekinin dışında yol taşıyan satır sayısı) `0`; değilse satırlar B'den önce temizlenir.
5. 01 çıktısında `DUR` yok; 02 çıktısı saklandı; tam yedek alındı; bu adım için yazılı O-5 onayı var.

| Adım | Dosya | Ne yapar | Beklenen çıktı |
|---|---|---|---|
| 1 | `01_preflight.sql` | Okur (tek SELECT) — B'nin kapısı | `DUR` yok; 4. satır (A) ve 5. satır (depolama erişimi) `TAMAM` |
| 2 | `02_save_state.sql` | Okur; yetki durumunu kaydeder | Çıktı saklanır (`KAYDET` satırları) |
| 3 | `03_apply.sql` | Tek işlemde uygular (`lock_timeout 3s`, `statement_timeout 30s`) | Sonuç satırı: `media_assets_pending_shape tetikleyici sayısı = 1` |
| 4 | `04_postflight.sql` | Okur | Tüm satırlar `TAMAM` |
| 5 | `05_rollback.sql` | Yalnızca geri dönüş gerekirse; tek işlem | Sonra 01 yeniden: 6., 7., 8. satırlar 02 çıktısıyla aynı |

## Etki

- `authenticated`: UPDATE yalnız `alt_text`, `sort_order`, `is_cover` sütunlarında; INSERT yalnız 12 sütunda
  (`id, organization_id, property_id, kind, status, original_path, mime_type, byte_size, original_filename, created_by, sort_order, alt_text`);
  DELETE açık; `TRUNCATE/REFERENCES/TRIGGER` kaldırılır. `status`, boyutlar, yollar, `public_base` değişimi yalnız `media_finalize` / `media_mark_failed` ile.
- `media_assets_pending_shape` (BEFORE INSERT, SECURITY INVOKER; `postgres`, `service_role`, `supabase_admin` dışındaki her rolde çalışır): çağıran o kurumda
  `media.manage` yetkisine sahipse (ya da süper admin) `status = 'pending'`, kanonik yol (`id` yolda), `byte_size` 1–52428800, 4 izinli MIME türü, kurum başına
  en çok **50** bekleyen ya da başarısız (`pending` + `failed`) satır (`media_pending_limit`) denetlenir; yetkisizde denetim yok, RLS tek tip reddeder.
- Eskiden kanonik olmayan yolla ekleyen istemciler (eski kod) artık reddedilir; yeni kod `id` ve `organizations/<kurum>/properties/<ilan>/images/<id>/original`
  (yazı kapağı: `organizations/<kurum>/content/<id>/original`) gönderir.

## Geri dönüş

`05_rollback.sql` şekil tetikleyicisini siler ve tablo düzeyi `UPDATE/INSERT` (+ `TRUNCATE/REFERENCES/TRIGGER`) yetkilerini `authenticated`'a geri verir.
**B'den sonra uygulama kodu geri alınacaksa (Instant Rollback) ÖNCE bu 05 çalıştırılır**, sonra dağıtım geri alınır; aksi halde eski kod 42501 alır.
**B her zaman A'dan önce geri alınır** (A'nın 05'i B varken durur).

Birim testi LR-14 (`tests/unit/launch-readiness.test.mjs`) gövdenin pending dosyayla aynı olduğunu, okuyan betiklerin yazmadığını, 04 gövde özetinin (md5)
pending `media_assets_pending_shape` ile eşleştiğini ve 05'in geri dönüş ifadelerini içerdiğini denetler. Davranış testleri:
`tests/security/media-finalize.test.mjs` (MF-03, MF-07: eski kod cümleleri A altında geçer, A+B altında 42501).
