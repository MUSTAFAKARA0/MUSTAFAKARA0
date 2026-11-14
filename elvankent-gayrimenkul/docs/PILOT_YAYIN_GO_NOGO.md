# PILOT READY · son aşama: güvenlik, hata izleme, canlıya geçiş sırası ve GO / NO-GO

> 11.11.2026, güncelleme 14.11.2026 · dal `claude/karays-refocus-t84k81` · **bu belge onay değildir; hiçbir adım uygulanmadı.**
> Her satır ayrı sahip onayıyla yapılır. Ayrıntı tekrarlanmaz; ilgili runbook ve belgeye bağlanır.
> Kapsam dışı (bu aşamada yapılmaz): ödeme/POS, yeni tema sistemi, müşteri kazanımı, Mission Control, yeni pano, görsel değişiklik.

## 1. Denetimde görülen gerçek durum (14.11, salt okunur)

| Konu | Durum | Kanıt |
|---|---|---|
| Production | `d6113e6` (PR #6, 03.11), Vercel production dağıtımı READY; bu dal `ec051db` itibarıyla 35 commit önde, production'da bu dalda olmayan tek commit PR #6'nın birleştirme commit'i; birleştirme denemesi çakışmasız | `git merge-tree` (yazmadan), Vercel dağıtım listesi |
| Yayın bekleyen kod | 119 dosya; `supabase/migrations` değişmiyor (E–I `supabase/pending` altında, kendiliğinden uygulanmaz); yeni ortam değişkeni gerekmiyor | `git diff`, `process.env` karşılaştırması |
| CI | **#233 (`e2edf71`, 14.11) üç iş yeşil**: quality, database (güvenlik, KI-24/KI-23 provaları, E2E 231 geçti, 4 atlandı, 0 hata), database-legacy-schema. Önceki: **#228 (`ec051db`) üç iş yeşil**: quality (gitleaks dahil), database (E2E 231 geçti, 4 atlandı, 0 hata), database-legacy-schema. Yerel birim 964/964. #227 kırmızısı (test dosyasında anahtar biçimli uydurma değer) sahip onayıyla son commit yeniden yazılarak giderildi | Actions |
| Gece yedeği | #54–#65 yeşil (son: 14.11), production dalından, `uretim-yedek` ortamıyla | Actions |
| Vercel önizleme | Bu dalın önizleme derlemelerinin hepsi `ERROR`: önizleme ortamında Supabase/site değişkenleri yok ve `next.config.ts › checkDeploymentEnv` derlemeyi bilerek durduruyor. Kod hatası değil; ama yeni kod **gerçek Vercel + Supabase üzerinde ilk kez production'da** çalışacak. Önlem: §4.1 duman testi ve hazır geri dönüş (Promote) | Vercel derleme logu `dpl_kR5V…` |
| Node sürümü | Vercel `engines: >=20.9.0` yüzünden proje ayarındaki 22.x yerine **26.x** kullanıyor; production `d6113e6` da 26.x ile derlendi (yeni değil). CI 22 ile test ediyor: bilinen, düşük risk; değiştirilmedi | Vercel derleme uyarısı |
| KI-41 kural seti | `koruma` (etkin, istisna listesi boş): production + eski çalışma dalı; kurallar yalnız **silme** ve **zorla push** engeli. **PR zorunluluğu yok.** Bu dalda hiç kural yok | GitHub `rulesets` ve `rules/branches` (herkese açık, salt okunur) |
| İş akışları | Hiçbiri depoya push etmiyor, `contents: write` yok → PR zorunluluğu hiçbir otomasyonu kırmaz | `.github/workflows/*` |
| Canlı veritabanı | Bu oturumdan **erişilemiyor** (bilinçli). Canlı şema doğrulaması sahibin çalıştıracağı salt okunur sorgularla yapılır | — |
| Sentry | `SENTRY_DSN` Vercel'de yalnız Production için tanımlı (değer okunmadı); olayın Sentry'ye ulaştığı **henüz kanıtlanmadı** | Vercel değişken adları |

## 2. KI-41 · tamamlanan ve kalan

| Aşama | İş | Durum |
|---|---|---|
| 0 | `uretim-yedek` ortamı + dal sınırı | ✓ (02.11) |
| 1 | Yedek işi ortamda; R2 teşhisi yalnız elle + ortamda; CI sır kullanmıyor | ✓ production'da (`workflow-secrets.test.mjs`) |
| 2 | Production dalına **PR zorunluluğu** | **AÇIK — ilk sahip adımı (§2.1)** |
| 3 | Yedek sırları `uretim-yedek` ortamına, **yeni değerlerle** (Supabase S3 + R2 anahtarı yeniden üretilir) | açık (sahip; Aşama 4 ile aynı oturum) |
| 3b | R2 `db/` saklama kilidi + yaşam döngüsü; sonra iş akışındaki silme adımı kaldırılır (kod, PR) | açık (sahip Cloudflare + küçük PR) |
| 4 | Diğer ortam sırları, depo düzeyindeki hassas sırların silinmesi, eski anahtarların iptali, veritabanı parolası döndürme | açık (sahip) |
| 5 | Yedek/denetim için salt okunur veritabanı kullanıcısı (canlıya yazar; runbook + yerel prova gerekir) | açık (hazırlığı Claude, uygulaması sahip) |
| 6 | Claude için ayrı GitHub hesabı (T2: Claude'un push'ları sahibin kimliğiyle) | açık (sahip) |

Ayrıntı ve geri dönüşler: [KI41_GUVENLIK_PLANI.md](KI41_GUVENLIK_PLANI.md) §4. Aşama 3–4'te anahtar döndürme **Vercel'i etkilemez**
(Vercel bu sırları kullanmaz); veritabanı parolası döndürülürken Vercel'deki uygulama anahtarları (anon / service role) değişmez.
Aşama 3–5 migration pencereleriyle **aynı güne konmaz**: yedek kırılırsa migration'ın "taze yedek" koşulu sağlanamaz.

### 2.1 İlk sahip adımı · Aşama 2 (GitHub arayüzü, ~5 dk, canlıya etkisi yok)

`koruma` kural seti eski çalışma dalını da kapsadığı için PR kuralı ona **eklenmez** (çalışma dalına push'u da keserdi); production
için ayrı bir kural seti açılır:

1. GitHub › `MUSTAFAKARA0/MUSTAFAKARA0` › **Settings** › **Rules** › **Rulesets** › **New ruleset** › **New branch ruleset**.
2. Ruleset name: `uretim-pr` · Enforcement status: **Active** · Bypass list: **boş bırakın**.
3. Target branches › **Add target** › **Include by pattern** › tam ad: `claude/elvankent-real-estate-platform-vxq9dj` (joker yok).
4. Rules: yalnız **Require a pull request before merging** işaretlenir; **Required approvals: 0**; altındaki diğer kutular boş.
5. **Create**.
6. (Önerilen, aynı ekranda) `koruma` › Target branches › **Add target** › `claude/karays-refocus-t84k81` › **Save** — yayın bekleyen
   35 commit'in dalı silinmeye ve zorla push'a karşı korunur; olağan push etkilenmez.
7. Claude'a "Aşama 2 tamam" yazın. Claude kural setlerini salt okunur okuyup doğrular (production'a deneme push'u **yapılmaz**).

| | |
|---|---|
| GO | Production'a bugüne kadar yalnız PR ile yazıldı (#3–#6); hiçbir iş akışı push etmiyor; Vercel yayını birleştirmeyle tetikleniyor (değişmez) |
| NO-GO | Yok. (Acil geri dönüş git gerektirmez: Vercel › Deployments › önceki dağıtım › Promote) |
| Geri dönüş | `uretim-pr` › Enforcement: Disabled (tek tık) |
| Sınır | Bu kural sırları korumaz; T1 (depo düzeyi sır) Aşama 3–4 ile, T2 Aşama 6 ile kapanır |

## 3. A7 · hata izleme (Sentry) — gerçek durum ve deneme planı

**Kod (denetlendi):** SDK yok; `reportError` her hatayı tek satır JSON loglar ve DSN varsa Sentry envelope API'sine gönderir. Sunucu
hataları `instrumentation.ts › onRequestError`, tarayıcı hataları `/api/monitoring/client-error` (çapraz site reddi, 8 KB sınırı, şema,
IP özeti başına dakikada 20). Gönderilen: hata türü, maskelenmiş mesaj ve yığın, **sorgu parametresiz** yol, yöntem, rota, ortam, sürüm.
Gönderilmeyen: başlık, çerez, form/gövde, kullanıcı kimliği, IP, e-posta/telefon/JWT/uzun anahtar (maskelenir).

**Bu commit'te kapatılan boşluk:** Sentry'nin yanıt kodu denetlenmiyordu; yanlış ya da iptal edilmiş DSN, kota (429) ve ağ hatası
**tamamen sessizdi**. Artık Vercel loglarında `"source":"monitoring"` uyarı satırı (hedef adı + `HTTP 401` gibi neden; adres/anahtar
yok). Kanıt: `tests/unit/monitoring.test.mjs` MN-01…04 (12 test; eski kodda MN-03'ün 3 testi kırmızı).

**Kanıtlanmayan (A7 bu yüzden ✓ değil):** production'dan giden olayın doğru Sentry projesine ulaştığı, olayın içeriğinin temiz
göründüğü ve sahibe bildirim geldiği. Claude'un Sentry erişimi yok; kabulü sahip Sentry ekranında yapar.

### Deneme planı (ayrı onay: "A7 deneme olayına onay veriyorum")

| # | Kim | Adım | Beklenen |
|---|---|---|---|
| 1 | Claude | Production'a **tek** istek: `POST /api/monitoring/client-error`, gövde: `A7TestError`, mesaj `KARAYS-A7-DENEME-<tarih>` + uydurma e-posta ve telefon, yol `/a7-deneme?token=deneme` | `204`. Veritabanına yazılmaz, yayın yapılmaz, gerçek kişi verisi yok |
| 2 | Claude | Vercel çalışma zamanı logları | `"level":"error","kind":"client"` satırı; mesajda `[e-posta]`, `[telefon]`; yol `/a7-deneme` |
| 3 | Sahip | Sentry › `karays` projesi › Issues (1–2 dk) | `A7TestError: KARAYS-A7-DENEME-…` görünür; environment `production` |
| 4 | Sahip | Olayın içinde ara: uydurma e-posta, telefon, `token=deneme`; User / IP / Cookies / Headers alanları | Hiçbiri yok |
| 5 | Sahip | E-posta kutusu; yoksa Sentry › Alerts › "yeni sorun → e-posta" kuralı | Bildirim geldi (ya da kural açıldı ve 1. adım bir kez yinelendi) |
| 6 | Sahip | Sentry › Settings › Security & Privacy: **Data Scrubber** açık, **Prevent Storing of IP Addresses** açık; bölge AB | Açık |
| 7 | Sahip | Deneme sorununu **Resolve** | Liste temiz |

**PASS:** 1–5 tamam. **FAIL:** 3. adımda olay yoksa DSN / proje / kota incelenir (yeni kod yayındaysa 2. adımda `monitoring` uyarısı
nedeni söyler); düzeltilene kadar A7 "kısmen" kalır. Kod yayınından sonra 1–3 bir kez yinelenir (yeni kodun aynı yolu).
Kasıtlı sunucu 500'ü üretilmez (bunun için canlıya hata veren kod koymak gerekir); sunucu yolu aynı `reportError`'dan geçer.

**Hata sonrası takip akışı:** Sentry e-postası → sorunun `digest` etiketi → Vercel › Logs'ta aynı `digest` → önem derecesi ve
müdahale: [operations/incident-response.md](operations/incident-response.md) (S1 hemen, S2 4 saat, S3 1 iş günü). Açık olan: harici
erişilebilirlik izleyicisi (`/api/health`, 5 dk) sahibin hesabıyla kurulmadı (D-18 / C6 ile birlikte).

## 4. Kod ve E/F/G/H/I için yayın sırası

**İlke:** önce kod, sonra migration'lar. Yeni kodun eski şemada çalıştığı CI'da kanıtlı (`database-legacy-schema` işi: bekleyen
migration'lar uygulanmadan panel + kabul E2E'si yeşil); eski kodun yeni şemada çalıştığı ise yalnız kod okumasıyla gösterildi.
Kod önce yayınlanırsa her migration, kendi kabul testiyle (yeni ekranlar) hemen doğrulanabilir.

| Sıra | İş | Bağımlılık | Kod ↔ şema | Veri / kesinti riski | Geri alma | Canlı sonrası |
|---|---|---|---|---|---|---|
| 0 | Canlı şema doğrulaması (salt okunur): `canli_sema_tespiti.sql` → 1–39 `VAR`, 40–44 `YOK`; her runbook'un `01_preflight.sql`'i | — | — | Yok (yalnız okur) | — | Çıktılar saklanır |
| 1 | **Kod** (PR: bu dal → production; sahip birleştirir; Vercel kendiliğinden yayınlar) | — | Yeni kod eski şemada: CI kanıtlı. Şema yokken: yetki belgesi kartı gizli, pilot bitişi anlaşılır hata verir, kurulum akışı ve kilit yok | 119 dosya; Elvankent'in sitesi aynı dağıtımda. Alan adına göre HSTS başlığı (`hsts.test.mjs`) bu yayınla gelir | Vercel › önceki dağıtım › Promote (dakikalar; veritabanı değişmediği için güvenli) | Duman testi: Elvankent ana sayfa, ilan, form, panel girişi, `/api/health`, `Strict-Transport-Security` başlığı; A7 deneme tekrarı |
| 2 | **F** · KI-46 üyelik koruması | Yok | Kod gerekmez; yeni kod anlaşılır ret mesajı verir | Veri değişmez; kısa tetikleyici kilidi. Yanlış rette ekip üyesi eklenemez | `tenant_member_guard/05` | [GO_NOGO_KI42_KI46.md](GO_NOGO_KI42_KI46.md) (a)–(f) |
| 3 | **E** · KI-42 fotoğraf boyut koruması | C (canlıda, 02.11) | Kod gerekmez | Veri değişmez. Yanlış rette **fotoğraf yüklenemez** → hemen 05 | `media_size_guard/05` | Aynı belge (a)–(e); 6 MB altı ve üstü fotoğraf |
| 4 | **G** · KI-47 yetki belgesi no | Yok | Serbest | `ADD COLUMN` (NULL), tablo yeniden yazılmaz | `license_no/05` — **girilmiş numaralar silinir** (önce 02 saklanır) | Numara gir → alt bilgide görünür; boşalt → kaybolur |
| 5 | **H** · pilot deneme bitişi | Yok | Serbest | Yalnız fonksiyon; veri değişmez | `pilot_trial_end/05` (girilmiş tarihler kalır) | Deneme ofisinde bitişi değiştir → şerit yeni tarihi gösterir |
| 6 | **I** · ilk kurulum + tasarım kilidi | Yok (aile yetkileri ve `site_apply_design` canlıda) | Serbest; **pilot ofis I'dan SONRA açılmalı** (önce açılan her ofis `legacy` sayılır: kurulum akışı ve kilit olmaz) | Yalnız `organization_setup` satırları eklenir; `organizations` ve `site_configs`'e tetikleyici (kısa kilit, `lock_timeout` 3 sn). Elvankent `legacy`: akışa girmez, kilitlenmez | `org_setup/05` (kurulum durumu silinir, seçilmiş tasarımlar kalır; yeniden 03'te tüm ofisler `legacy`) | Deneme ofisi aç → davet → `/admin/kurulum` → tasarım seç → kilit → konsoldan yeniden aç (README sırası) |

### 4.1 Kod yayını PR'ı (B1 / G5) — hazır, açılmadı

| | |
|---|---|
| Kaynak → hedef | `claude/karays-refocus-t84k81` → `claude/elvankent-real-estate-platform-vxq9dj` (production, varsayılan dal) |
| Kapsam | ~36 commit (bu güncelleme dahil), ~124 dosya. Değişmeyen: `supabase/migrations` (E–I `supabase/pending` altında, kendiliğinden uygulanmaz), `.claude/`, Vercel ortam değişkenleri. Yeni iş akışı: `elvankent-yedek-izleme` (sırsız, günlük; yedek koşularını izler) |
| Başlık önerisi | `Pilot hazırlığı: ofis açılışı, ilk kurulum ve tasarım kilidi, kiracı/medya korumaları, yetki belgesi no, izleme düzeltmesi` |
| Birleştirme yöntemi | **Create a merge commit** (önceki PR #3–#6 ile aynı; geçmiş korunur) |
| Birleştirmeden önce | PR'ın CI koşusu üç iş yeşil · G3 canlı şema çıktısı alındı · taze yedek yeşil · düşük trafik saati |
| Birleştirmeden hemen sonra (≤ 15 dk) | Vercel production dağıtımı READY · `/api/health` 200 · Elvankent ana sayfası, bir ilan, iletişim formu · ofis paneli girişi · KARAYS sayfası · yanıt başlığında `Strict-Transport-Security` · Vercel › Logs'ta yeni `"level":"error"` yok · A7 deneme olayı (ayrı onaylıysa) |
| Geri dönüş | Vercel › Deployments › `d6113e6` dağıtımı › **Promote** (Instant Rollback adayı). Veritabanı değişmediği için güvenli; git'te geri alma gerekmez |
| Kim | Claude PR'ı açar (**sahip onayıyla**); sahip birleştirir; Claude duman testini yapar ve raporlar |

**Her migration için ortak kural** (runbook `README.md`): production dalından **taze yedek** (yeşil, ≤ 3 saat; bir öncekinin 04'ü
`TAMAM` olduktan sonra alınmış) → `01` (sakla) → `02` (sakla) → `03` → `04` hepsi `TAMAM` → canlı sonrası testler → 24 saat gözlem.
Sahip, Supabase SQL Editor'de çalıştırır; 01 / 02 / 04 yazmaz. Düşük trafik saatinde; bir pencerede en çok iki migration; I tek başına.
`01`'de `DUR` ya da `04`'te `HATA` → devam edilmez; canlı sonrası test başarısız → o migration'ın `05`'i.

**Elvankent'in canlı sitesi:** 1. adım (kod) dışında ziyaretçi tarafını değiştiren adım yok. E yalnız panelden fotoğraf yüklemeyi, F
ekip üyesi eklemeyi etkileyebilir; ikisi de `05` ile dakikalar içinde geri alınır. G/H/I Elvankent'te görünür bir değişiklik yapmaz.

## 5. Production'a geçiş · kesin GO / NO-GO listesi

Bir satır "hayır" ise o adım ve sonrası yapılmaz.

| # | Koşul | Durum (11.11) |
|---|---|---|
| G1 | KI-41 Aşama 2: production'a PR zorunluluğu etkin (`uretim-pr`) | ☐ sahip (§2.1) |
| G2 | A7: deneme olayı Sentry'de görüldü, içerik temiz, bildirim geldi | ☐ ayrı onay (§3) |
| G3 | Canlı şema: 1–39 `VAR`, 40–44 `YOK`; beş `01_preflight` `DUR` içermiyor | ☐ sahip çalıştırır (salt okunur) |
| G4 | CI: yayınlanacak commit'te üç iş yeşil | ✓ `e2edf71` CI #233 (önceki `ec051db` #228; PR'da yeni commit olursa yeniden) |
| G5 | Kod yayını onayı: PR açılması ve birleştirme | ☐ ayrı onay |
| G6 | Kod yayını sonrası duman testi ve A7 tekrarı temiz; 24 saat hata artışı yok | ☐ |
| G7 | F: onay + taze yedek + 01'in 7. ve 8. satırları sahipçe görüldü | ☐ ayrı onay |
| G8 | E: onay + taze yedek + 01 satır 12 `TAMAM` | ☐ ayrı onay |
| G9 | G, H, I: her biri için onay + taze yedek + 04 `TAMAM` + kabul testi | ☐ ayrı onaylar |
| G10 | KI-41 Aşama 3–4: sırlar ortamlarda, anahtarlar döndürüldü, depo sırları silindi; ertesi gece yedeği yeşil | ☐ sahip (ayrı gün) |
| G11 | Barındırma planı (Vercel Pro / Supabase Pro, D-11) | ☐ sahip kararı |
| G12 | Hukuki / işletme kararları C1–C6 ([PILOT_KABUL_KAPISI.md](PILOT_KABUL_KAPISI.md) §C) | ☐ sahip + avukat |
| G13 | Pilot ofisin açılması (gerçek ofis, gerçek veri, alan adı) | ☐ G1–G12 sonrası, ayrı onay |

**Kesin NO-GO:** taze yedek yok · `01`'de `DUR` · CI kırmızı · son 24 saatte Elvankent'ten yükleme/panel şikâyeti · A7 FAIL iken
pilot ofis açılışı · C2 (sözleşme / veri işleme) tamamlanmadan gerçek müşteri verisi.

KI-41 Aşama 5 ve 6 pilot açılışını **engellemez** ama açık risktir (yedek tam yetkili veritabanı adresiyle çalışıyor; Claude'un
push'ları sahibin kimliğiyle); pilot süresince kapatılması önerilir.

## 6. Gerçek pilotu engelleyen kararlar (14.11)

Teknik hazırlık kodda tamam (A1–A6, A8–A12 ✓; A7 kısmen). Kalan engellerin hiçbiri Claude'un tek başına kapatabileceği iş değildir.

**Teknik (sahip işlemi veya onayı):**
1. KI-41 Aşama 2 — production'a PR zorunluluğu (§2.1).
2. A7 — Sentry deneme olayı (§3).
3. Canlı şema doğrulaması — `canli_sema_tespiti.sql` + beş `01_preflight` (salt okunur, SQL Editor).
4. Kod yayını — PR'ın açılması ve birleştirilmesi (§4.1).
5. Migration'lar F → E → G → H → I — her biri taze yedek + ayrı onay.
6. KI-41 Aşama 3–4 — yedek sırlarının ortamlara taşınması, anahtar döndürme, depo sırlarının silinmesi (migration'larla aynı gün değil).

**Hukuki (sahip + avukat; kod tarafı karar gelince işlenir):**
1. Hizmeti veren taraf: şahıs/şirket, unvan, VKN, adres, KEP (C1 / D-19).
2. Pilot sözleşmesi ve veri işleme sözleşmesi: ofis veri sorumlusu, KARAYS veri işleyen (C2 / D-10).
3. Yurt dışı aktarım (KVKK m.9): Supabase, Vercel, Resend, Sentry, Cloudflare için standart sözleşme + 5 iş günü içinde Kurum'a bildirim.
4. KARAYS ve ofis sitesi aydınlatma/çerez metinlerinin avukat onayı (C3; metinler kodda taslak).
5. Yetki belgesi numarasının gösterileceği kanal ve EİDS kapsamı (C4 / D-20).
6. Saklama süreleri ve pilot sonunda verinin akıbeti (D-05 / D-10).

**Ticari (sahip; ödeme gerektirenler ayrıca onaylanır):**
1. Barındırma planı: Vercel Pro (Hobby ticari kullanıma kapalı) ve Supabase Pro (platform yedeği) — ücretli (D-11).
2. Pilot süresi, ücretsiz olup olmadığı ve sonunda ne olacağı; ofise yazılı söz (C5).
3. Destek kanalı ve olay sorumlusu, yanıt süresi (C6 / D-18).
4. Pilot ofisin alan adı ve DNS geçişi (ofisin onayıyla; MX korunur).

Pilot için **gerekmeyen** kararlar: fiyat listesi ve ödeme sağlayıcısı (D-01…D-03, D-07…D-09), OPS-02 bayrağı (kapalı kalır),
CSP joker kaldırma (KI-32), KI-41 Aşama 5–6 (pilot süresince kapatılması önerilir).

