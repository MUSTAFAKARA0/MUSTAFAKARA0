# KI-41 · Aşama 3–4 uygulama planı (sırlar ortamlara, anahtar yenileme, depo sırlarının silinmesi)

> 14.11.2026 · hazırlayan Claude · **onay değildir; hiçbir anahtar değiştirilmedi, taşınmadı, silinmedi.**
> Uygulayan: sahip (GitHub, Supabase, Cloudflare arayüzleri). Claude her doğrulama adımında Actions sonucunu salt okunur okur.
> Değerleri hiçbir yere (sohbet, belge, ekran görüntüsü) yazmayın; bana yalnız "tamam" ve koşu numarası yeter.
> Genel plan ve tehdit modeli: [KI41_GUVENLIK_PLANI.md](KI41_GUVENLIK_PLANI.md) §2–§4.

## 1. Denetimde görülen durum (14.11, salt okunur)

| Konu | Durum | Kanıt |
|---|---|---|
| Aşama 2 | ✓ `uretim-pr` (etkin): production dalında PR zorunlu (onay 0), silme ve zorla push engeli. `koruma`: production, eski çalışma dalı ve `claude/karays-refocus-t84k81` | GitHub `rulesets`, `rules/branches` |
| Ortamlar (dağıtım kayıtlarından) | `uretim-yedek` (son kullanım 14.11, production dalı), `o5a-uygula` (02.11, eski çalışma dalı), `ki23-canli-denetim` (02.11), `restore-drill` (02.11) | `deployments` API |
| Ortam sırları ve dal kuralları | **Bu oturumdan okunamıyor** (ortamlar API'si vekil sunucuda kapalı) → Adım 0'da sahip ad listesini çıkarır | — |
| Gece yedeği | `elvankent-backup`, cron 01:23 UTC; gerçekte 07:40–08:25 UTC'de başlıyor (GitHub gecikmesi) = **10:40–11:25 TR**. Aynı anda iki yedek çalışmaz (`concurrency`) | Actions #54–#65 |
| Yedek izleme | `elvankent-yedek-izleme` yalnız geliştirme dalında (production'da değil); kod yayınından sonra her gün 16:47 TR | iş akışı dosyası |
| Vercel | Bu sırların hiçbirini kullanmaz (ortam değişkenlerinde `SUPABASE_DB_URL` yok; uygulama anon/service role anahtarlarıyla çalışır) → **site etkilenmez** | Vercel değişken adları |

### Hangi iş hangi sırrı okuyor (production dalındaki iş akışları)

| İş akışı · iş | Ortam | Sırlar | Değişkenler |
|---|---|---|---|
| `elvankent-backup` · backup | `uretim-yedek` | `SUPABASE_DB_URL`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` (9) | `ELVANKENT_BACKUP_ENABLED`, `BACKUP_BUCKET`, `BACKUP_S3_PROVIDER`, `BACKUP_RETENTION_DAYS` |
| `elvankent-r2-diagnose` (yalnız elle) | `uretim-yedek` | `BACKUP_S3_*` (4), `SUPABASE_S3_*` (4) | `BACKUP_BUCKET`, `BACKUP_S3_PROVIDER` |
| `elvankent-restore-drill` (eski çalışma dalı) | `restore-drill` | `RESTORE_S3_ACCESS_KEY_ID`, `RESTORE_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION` | `BACKUP_BUCKET`, `BACKUP_S3_PROVIDER`, `RESTORE_DRILL_REAL_DATA_APPROVED` |
| `elvankent-ki23-canli-denetim` (eski çalışma dalı) | `ki23-canli-denetim` | `SUPABASE_DB_URL` | — |
| `elvankent-o5a/o5b/o5c-uygula` (eski çalışma dalı; O-5 bitti) | `o5a-uygula` | `SUPABASE_DB_URL` | — |
| `elvankent-ci`, diğerleri | — | **sır yok** | — |

**Önerilen sadeleştirme (karar sizde):** E–I migration'ları SQL Editor'den uygulanacağı için `o5a-uygula` ve `ki23-canli-denetim`
ortamlarına tam yetkili veritabanı adresi **konmaz**. Tam yetkili adresin tek kopyası `uretim-yedek`'te kalır. İleride o iş akışları
gerekirse adres o gün eklenir ve iş bitince silinir. Böylece canlıya yazabilen adres yalnız production dalından çalışan yedek işinde durur.

**Değişkenler:** `ELVANKENT_BACKUP_ENABLED` **depo düzeyinde kalır** (iş düzeyindeki `if` ortamdan önce değerlendirilir; taşınırsa yedek
hiç çalışmaz). `BACKUP_BUCKET`, `BACKUP_S3_PROVIDER`, `BACKUP_RETENTION_DAYS` gizli değildir; depo düzeyinde kalmaları güvenlidir (değişiklik yok).

## 2. Ön koşullar (GO)

| # | Koşul |
|---|---|
| P1 | Son gece yedeği yeşil (aynı sabah) ve önceki iki gece de yeşil |
| P2 | Aynı gün migration (E–I) ya da kod yayını **yok** (yedek kırılırsa "taze yedek" koşulu sağlanamaz) |
| P3 | Pencere: **14:00–23:00 TR** (gece yedeğiyle çakışmaz); 2 saat ayrılır |
| P4 | Supabase, Cloudflare ve GitHub hesaplarına giriş açık; parola yöneticisi hazır (yeni değerler yalnız oraya ve GitHub'a) |
| P5 | Claude ulaşılabilir (her doğrulamada koşu numarasını okur) |

**NO-GO:** son yedek kırmızı · aynı gün başka canlı değişiklik · Adım 0'da beklenmeyen sır adı (ör. tanımadığınız bir sır) → önce konuşulur.

## 3. Adımlar

Her adımın sonunda **Doğrulama** geçmeden sonrakine geçilmez. Geri dönüş sütunu yalnız o adım içindir.

### Adım 0 · Envanter (salt okunur, 10 dk)
1. GitHub › Settings › Secrets and variables › **Actions** › *Repository secrets*: yalnız **adları** not edin.
2. Aynı sayfada *Repository variables*: adları ve `ELVANKENT_BACKUP_ENABLED = true` olduğunu görün.
3. Settings › **Environments** › her ortam (`uretim-yedek`, `restore-drill`, `ki23-canli-denetim`, `o5a-uygula`): *Deployment branches* kuralı ve *Environment secrets* **adları**.
4. Listeyi bana yazın (yalnız adlar). Claude beklenen listeyle karşılaştırır. `uretim-yedek` dal kuralı tam olarak
   `claude/elvankent-real-estate-platform-vxq9dj` değilse burada durulur.

### Adım 1 · Yeni anahtarlar sağlayıcıda (eskiler ÇALIŞMAYA DEVAM EDER, 15 dk)
1. **Supabase S3 anahtarı:** Supabase › proje › Storage › Settings (S3 Connection) › Access keys › **New access key** (ad: `yedek-2026-11`).
   Erişim anahtarı ve gizli anahtar yalnız bir kez görünür → parola yöneticisine. Eski anahtar silinmez.
2. **R2 yedek anahtarı (okuma + yazma):** Cloudflare › R2 › **Manage API tokens** › Create API token › izin *Object Read & Write*,
   kapsam **yalnız yedek kovası**, süre isteğe bağlı (ad: `karays-yedek-2026-11`). Access Key ID + Secret → parola yöneticisi. Eski token silinmez.
3. **R2 geri yükleme anahtarı (salt okunur):** aynı ekranda *Object Read only*, yalnız yedek kovası (ad: `karays-geri-yukleme-2026-11`).

Doğrulama: üç yeni değer parola yöneticisinde; sağlayıcılarda eski + yeni anahtar birlikte görünüyor.
Geri dönüş: yeni anahtarları sağlayıcıda silmek (henüz hiçbir yerde kullanılmıyor).

### Adım 2 · `uretim-yedek` ortam sırları (Aşama 3, 15 dk)
Settings › Environments › `uretim-yedek` › *Environment secrets* › Add secret — 9 sır, **aynı adlarla**:
- `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY` → **Adım 1.1'in yeni değerleri**
- `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` → **Adım 1.2'nin yeni değerleri**
- `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION` → mevcut değerler (Supabase Storage S3 ekranı ve Cloudflare R2 kova ayarlarından yeniden kopyalanır; GitHub'dan geri okunamaz)
- `SUPABASE_DB_URL` → **mevcut** parola ile, Supabase › Connect › **Session pooler** (IPv4) bağlantı adresi (parola Adım 6'da yenilenir)

Ortam sırrı aynı addaki depo sırrını gölgeler; depo sırları bu adımda **silinmez**.

**Doğrulama (Claude okur):** Actions › `elvankent-backup` › **Run workflow** › Branch: `claude/elvankent-real-estate-platform-vxq9dj` ›
yeşil; özet "Yedek alınmadı" demiyor; R2'de bugünün `db-…dump` + `.fingerprint.txt` + `.tables.txt` + `.sha256` ve `storage/current/…`.
Logda "Ortak anlık görüntü alınamadı" varsa `SUPABASE_DB_URL` session kipinde değildir → düzeltilir.

**Geri dönüş:** hatalı ortam sırrını silmek → iş yeniden depo sırrına (eski, hâlâ geçerli anahtarlara) düşer; elle yedek yeniden yeşil.

### Adım 3 · `restore-drill` ortamı (Aşama 4'ün parçası, 10 dk)
`restore-drill` › Environment secrets: `RESTORE_S3_ACCESS_KEY_ID`, `RESTORE_S3_SECRET_ACCESS_KEY` → **Adım 1.3'ün yeni salt okunur
değerleri**; `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION` → mevcut değerler. (Zaten ortamdaysa yalnız anahtar ikilisi güncellenir.)

Doğrulama: bu adımda prova **çalıştırılmaz** (iş akışı eski çalışma dalına bağlı ve gerçek veri onayı ister). Bir sonraki çeyrek
provasında (Şubat 2027) ya da ayrı onayla kanıtlanır. Anahtarın salt okunur olduğu Cloudflare ekranında görülür.
Geri dönüş: değerleri önceki salt okunur anahtarla güncellemek (eski anahtar Adım 5'e kadar geçerli).

### Adım 4 · Depo düzeyindeki hassas sırları silmek (Aşama 4, 10 dk)
Ön koşul: Adım 2 doğrulaması yeşil.
Settings › Secrets and variables › Actions › *Repository secrets* › şu adlar **silinir** (Adım 0 listesinde varsa):
`SUPABASE_DB_URL`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`,
`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`,
`RESTORE_S3_ACCESS_KEY_ID`, `RESTORE_S3_SECRET_ACCESS_KEY`. **Depo değişkenlerine dokunulmaz.**
`o5a-uygula` ve `ki23-canli-denetim` ortamlarında `SUPABASE_DB_URL` varsa (önerilen sadeleştirme kabul edildiyse) o ikisinden de silinir.

**Doğrulama (Claude okur):**
1. Production dalından elle yedek → **yeşil** (artık yalnız ortam sırlarıyla).
2. Actions › `elvankent-backup` › Run workflow › Branch: `claude/karays-refocus-t84k81` → **kırmızı ya da onay bekler / reddedilir**
   (dal kuralı çalışıyor; bu bir başarı kanıtıdır). Yedek almazsa iptal edin.

**Geri dönüş:** silinen sırrı depo düzeyinde yeniden eklemek (değer parola yöneticisinde). Site etkilenmez.

### Adım 5 · Eski anahtarları sağlayıcıda iptal (Aşama 4, 10 dk)
Ön koşul: Adım 4 doğrulaması (1) yeşil.
1. Supabase › Storage › S3 Connection › Access keys › **eski** anahtar › Delete.
2. Cloudflare › R2 › Manage API tokens › **eski** yedek token'ı ve eski salt okunur token › Delete (yalnız Adım 1'de oluşturulmayanlar).

**Doğrulama:** production dalından elle yedek → yeşil (yeni anahtarlar tek başına çalışıyor).
**Geri dönüş:** eski anahtar geri getirilemez; yedek kırmızıysa neden yanlış ortam değeridir → `uretim-yedek` sırrını parola
yöneticisindeki yeni değerle düzeltip yeniden çalıştırmak. Gerekirse sağlayıcıda bir anahtar daha üretilir (Adım 1 tekrarı).

### Adım 6 · Veritabanı parolasını yenilemek (Aşama 4, 15 dk) — ayrı gün de olabilir
Neden: eski parola, depo düzeyinde sır olarak bulunduğu süre boyunca iş akışlarına açıktı.
1. Supabase › Project Settings › Database › **Reset database password** → güçlü yeni parola → parola yöneticisi.
2. Hemen `uretim-yedek` › `SUPABASE_DB_URL` → yeni parolalı **Session pooler** adresi.
3. Elle yedek (production dalı) → yeşil.

Etki: Vercel'deki site ve panel etkilenmez (veritabanı parolasını kullanmaz; anon/service role anahtarları değişmez).
Bu parolayı kullanan başka bir araç (yerel bilgisayarda `psql`, bir masaüstü istemcisi) varsa orada da güncellenir.
**Geri dönüş:** eski parola geri gelmez; yedek kırmızıysa adres yeniden kopyalanır (çoğu hata yanlış kip ya da kopyalama).
Gece yedeğinden önce (10:40 TR) düzelmezse o gecenin yedeği kırmızı olur; düzeltince elle yedek alınır.

### Adım 7 · Ertesi sabah (Claude)
Zamanlanmış gece yedeği yeşil (#n), R2'de yeni dosyalar, parmak izi/tablo sayısı satırları beklenen biçimde. Ardından Claude
`KI41_GUVENLIK_PLANI.md`'yi "Aşama 3–4 ✓" olarak işler ve `tests/unit/workflow-secrets.test.mjs`'e hassas sırların yalnız
ortam işlerinde okunduğunu sabitleyen kontrolü ekler (kod, geliştirme dalı).

## 4. Özet sıra

`0 envanter → 1 yeni anahtarlar → 2 uretim-yedek + elle yedek ✓ → 3 restore-drill → 4 depo sırlarını sil + iki yönlü doğrulama →
5 eski anahtarları iptal + elle yedek ✓ → 6 DB parolası + elle yedek ✓ → 7 ertesi gece yedeği ✓`

Her ok bir durma noktasıdır: doğrulama kırmızıysa o adımın geri dönüşü uygulanır, sonrasına geçilmez.

## 5. Kapsam dışı (ayrı iş)

- **Aşama 3b** (R2 `db/` saklama kilidi + iş akışındaki silme adımının kaldırılması): Cloudflare ayarı + küçük PR; Aşama 3–4'ten sonra.
- **Aşama 5** (yedek için salt okunur veritabanı kullanıcısı): canlıya yazar; runbook + yerel prova + ayrı onay.
- **Aşama 6** (Claude için ayrı GitHub hesabı).
