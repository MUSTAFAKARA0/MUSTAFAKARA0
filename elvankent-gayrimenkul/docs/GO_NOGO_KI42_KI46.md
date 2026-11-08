# GO / NO-GO · KI-42 (E) ve KI-46 (F) canlı migration'ları

> 08.11.2026 · dal `claude/karays-refocus-t84k81` · **hiçbiri uygulanmadı; sahip onayı verilmedi.**
> İki işlem birbirinden **bağımsızdır**; ayrı onay, ayrı yedek, ayrı pencere. Herhangi bir NO-GO satırı "evet" ise o işlem yapılmaz.

## Ortak durum (kanıt)

| Konu | Değer | Kanıt |
|---|---|---|
| Güncel production commit | `d6113e6` (PR #6, 03.11) | `git ls-remote`: `claude/elvankent-real-estate-platform-vxq9dj` = `d6113e6c…` (varsayılan dal). Uygulamadan hemen önce Vercel production dağıtımının `d6113e6` ve READY olduğu ayrıca görülür |
| Kod/test | CI #214 (`443af1d`) üç iş yeşil; #215 (`93a11a6`) yeşil | SZ-01…08 (gerçek Storage, FormData + TUS), TG-01…07 (gerçek veritabanı), KI-24/KI-23 provaları, E2E, eski şema ayağı |
| Bu iki migration için uygulama kodu yayını | **Gerekmez** | E: panel zaten `File.size` bildirir. F: veritabanı kuralı tek başına yeter; `createMember`'ın anlaşılır mesajı (`account_unavailable`) bu dalda, production'da değil — o olmadan engellenen ekleme genel hata metniyle görünür |
| Canlı şema | 39 nesne grubu VAR, bekleyen yok (K-67); C (`media_storage_slots`) canlıda (o5c #2, 02.11, K-57) | `KALAN_ISLER.md` başlığı, `GELISTIRME_GUNLUGU.md` K-57 |

---

## KI-42 · E · `20261108000001_media_size_guard` (orijinal fotoğrafın gerçek boyutu ≤ bildirilen)

**Ne değişir:** `storage.objects` üzerinde bir tetikleyici; yalnız `media-originals` + kullanıcı oturumu/imzalı adres yazımında, gerçek
boyut bekleyen satırın bildirilen boyutunu aşarsa yazım reddedilir. Runbook: `supabase/ops/media_size_guard/`.

| Kontrol | GO koşulu | Kanıt / nasıl görülür |
|---|---|---|
| C bağımlılığı | 01 satır 4 `TAMAM` (C tetikleyicisi 1, bakım penceresi tablosu var) | C canlıda (K-57); E `apply C first` ile kendini korur; C'nin 05'i E varken durur (CI'da MF-07) |
| Storage gerçek boyutu yazıyor | 01 satır 12 `TAMAM` (son 30 günde kullanıcı yazımı > 0, boyutu sayısal olmayan = 0) | storage-api v1.82.1 `completeUpload` gerçek boyutu satırla aynı işlemde yazar (kaynak okundu); SZ-01…08 CI'da gerçek Storage'da yeşil. **Sınır:** barındırılan Supabase Storage sürümü CI'dakinden farklı olabilir → canlı deneme (a)(b) zorunlu |
| Panelin iki yolu etkilenmez | SZ-07 (FormData, gövde dosyadan büyük) ve SZ-08 (TUS, 7 MB) yeşil | `tests/security/media-size-guard.test.mjs` |
| Reddedilen dosyaların temizliği | Kabul edilen sınır | Storage, reddedilen yüklemenin baytlarını kendi silme kuyruğuyla siler (her başarısız yüklemedeki mekanizma; E ile yeni değil). Kuyruk çalışmazsa satırsız bayt kalır; kotada ve D süpürmesinde görünmez. Öneri: ayda bir Supabase › Storage kullanımı ile `storage.objects` toplamı karşılaştırması (ayrı iş) |
| Mevcut müşteri verisi | Değişmez | Satır/dosya yazılmaz; yalnız uygulamadan sonraki orijinal yazımları. 01 satır 9 (bildirilenden büyük bekleyen satır) yalnız sayar |
| Kilit / kesinti | 01 satır 10–11 `TAMAM`; düşük trafik | CREATE TRIGGER kısa kilit; `lock_timeout` 3 sn → alınamazsa hiçbir şey değişmez |

**NO-GO:** 01'de `DUR` · satır 12'nin ilk sayısı 0 ve canlı deneme yapılamayacaksa · taze yedek yok · son 24 saatte fotoğraf yükleme şikâyeti var.

**Sıra:** (1) Actions › `elvankent-backup` › Run workflow › **production dalı** › yeşil (son 3 saat içinde) → (2) SQL Editor: 01 (sakla) →
02 (sakla) → 03 → 04 (1–6 `TAMAM`) → (3) canlı sonrası testler.

**Canlı sonrası testler (sahip, ~10 dk):** (a) 6 MB altı fotoğraf → hazır; (b) 6 MB üstü (telefon) → hazır; (c) döndür + sil → çalışır;
(d) 04 yeniden `TAMAM`, `canli_sema_tespiti.sql` 40. satır `VAR`; (e) 24 saat sonra Supabase › Logs › Postgres'te `media_size_mismatch` yok.
(a) ya da (b) başarısızsa hemen 05.

**Rollback:** `05_rollback.sql` (yalnız tetikleyici + fonksiyon; veri yok; tek işlem). Sonra 01: 7. satır 0. Kod geri alınmaz.

**Müşteri etkisi:** Normal kullanımda yok. Yanlış ret olursa: fotoğraf yüklenemez ("Yükleme izni doğrulanamadı") → 05 ile dakikalar içinde geri.

**Gereken sahip onayı:** "KI-42 / E canlı uygulamasına onay veriyorum" + taze yedek koşu numarası.

---

## KI-46 · F · `20261108000002_tenant_member_guard` (izinsiz ofis üyeliği, yabancı ilan görseli)

**Ne değişir:** iki tetikleyici. Kullanıcı oturumunda: başka ofise bağlı ya da platform yöneticisi hesap üye eklenemez; üyelik
satırının kişisi değiştirilemez; ilanın paylaşım görseli (`og_media_id`) yalnız aynı ofisin medyası. Runbook: `supabase/ops/tenant_member_guard/`.

| Senaryo | Etkilenir mi | Kanıt / GO koşulu |
|---|---|---|
| **Mevcut çoklu ofis üyelikleri** | Hayır — mevcut satırlar değişmez | 01 satır 7 bu hesapları **sayar**. GO: sayı biliniyor ve her biri sahip tarafından tanınıyor (ör. sahibin hem KARAYS yöneticisi hem Elvankent üyesi olan hesabı). Tanınmayan varsa önce gözden geçirilir (izinsiz eklenmiş olabilir). F, böyle bir hesap çıkarılırsa panelden yeniden eklenmesini engeller (bilinçli) |
| **Yabancı ilan görselleri** | Hayır — mevcut değerler değişmez | 01 satır 8 başka ofisin medyasını gösteren `og_media_id` sayısı. GO: 0. Değilse önce o ilanların paylaşım görseli temizlenir |
| **Kullanıcı daveti (ekip)** | Hayır | Yeni (hiçbir ofise bağlı olmayan) hesap izinli (TG-03); çıkarılıp yeniden eklenen kişi izinli (TG-03). Davet gönderme/kabul service_role RPC'leri (`org_send_member_invitation`, `invitation_accept`) üyelik satırı yazmaz (kod okundu: `invitations/member.ts`, `actions/invitation.ts`). E2E "Emlakçı hesabı: sahip olarak eklenir, davetle şifre belirler" ve ekip daveti testleri #214'te yeşil |
| **KARAYS konsolundan ofis açılışı** | Hayır | `provisioning.ts:51` `platform_create_organization` süper yönetici oturumuyla; F süper yöneticiyi ve service_role'ü serbest bırakır (TG-05). Veritabanında üyelik yazan tek fonksiyon bu (migration taraması). E2E SC-01/02 #214'te yeşil |
| **Rol / durum değişikliği, üye çıkarma** | Hayır | Tetikleyici yalnız `user_id` güncellemesinde çalışır (TG-04; MC-01…03 yeşil) |
| **Başka ofisin kullanıcısını ekleme** | **Evet (amaç)** | Production kodunda genel hata metni; bu daldaki kodla "Bu e-posta adresi ekibinize eklenemiyor…". Gerçek ihtiyaçta KARAYS konsolu ekler |

**NO-GO:** 01'de `DUR` · satır 7'de sahibin tanımadığı çoklu üyelik · satır 8 ≠ 0 (önce temizlik) · taze yedek yok.

**Sıra:** taze yedek (production dalı) → 01 (sakla; 7. ve 8. satırları sahip okur) → 02 (sakla) → 03 → 04 (1–6 `TAMAM`) → canlı sonrası testler.

**Canlı sonrası testler (sahip, ~10 dk):** (a) panelde yeni bir e-postayla ekip üyesi → davet gider; (b) o kişiyi çıkar, yeniden ekle → eklenir;
(c) başka ofisteki bir test hesabının e-postasıyla dene → reddedilir; (d) bir ilanın paylaşım görselini kendi fotoğrafıyla değiştir → çalışır;
(e) KARAYS konsolunda ofis açılışı (deneme ya da ilk gerçek açılışta izlenir) → çalışır; (f) 04 yeniden `TAMAM`, `canli_sema_tespiti.sql`
41. satır `VAR`. (a), (b) ya da (d) başarısızsa hemen 05.

**Rollback:** `05_rollback.sql` (iki tetikleyici + iki fonksiyon; veri yok; tek işlem). E ile bağımsız.

**Müşteri etkisi:** Normal kullanımda yok. Yanlış ret olursa: ekip üyesi eklenemez ya da paylaşım görseli değiştirilemez → 05.

**Gereken sahip onayı:** "KI-46 / F canlı uygulamasına onay veriyorum" + 01'in 7. ve 8. satırlarını gördüğünü + taze yedek koşu numarası.

---

## Önerilen sıra

Önce **F** (müşteri verisi güvenliği), sonraki düşük trafik penceresinde **E**. İkisi aynı pencerede de yapılabilir; her biri kendi 01–04'ü ve
canlı sonrası testleriyle.
