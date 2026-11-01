# KI-24 · Gerçek yedekle geri yükleme provası — test planı (TASLAK, onay bekliyor)

> 01.11.2026 · Bu belge yalnız **plandır**. Hiçbir geri yükleme başlatılmadı; iş akışı henüz yazılmadı.
> Uygulama ve ilk çalıştırma sahibin **açık onayından** sonra yapılır (aşağıda "Onay kapıları").

## 1. Amaç ve kabul ölçütü

Backup #45'in R2'ye yazdığı gerçek yedeğin **geri yüklenebildiğini** kanıtlamak (yalnız alınmış olması yetmez):

| # | Ölçüt | Kaynak |
|---|---|---|
| K1 | `sha256sum -c db-<STAMP>.sha256` → üç dosya OK | scripts/restore-drill.sh adım 1 |
| K2 | `pg_restore --list` okunuyor; tek işlemde (`--single-transaction`) geri yükleme hatasız | adım 2–4 |
| K3 | Parmak izi (kritik tablolar: sayı + özet) yedektekiyle **birebir** | adım 5 |
| K4 | Yedekteki her tablonun satır sayısı **birebir** | adım 6 |
| K5 | `postflight_v2.sql`: HATA satırı yok (RLS, yetkiler, yalnız sunucuya açık fonksiyonlar kapalı) | adım 7 |
| K6 | Storage örneği: R2'deki `storage/current/` kopyasından seçilen N dosya, yerel (geçici) Storage'a yüklenip geri indirildiğinde SHA-256 aynı | yeni adım |
| K7 | Geçici veritabanı ve dosyalar iş sonunda silinmiş; günlükte kayıt içeriği/sayısı, yol, kimlik yok | adım 8 + günlük denetimi |
| K8 | Süre (RTO ölçümü): indirme + geri yükleme + doğrulama toplamı kaydedilir | özet |

## 2. Neden bilgisayara kurulum gerekmez

Prova, GitHub'ın **tek kullanımlık** çalıştırıcısında (ubuntu-24.04) yapılır; iş bitince makine yok edilir:
- Hedef sunucu: çalıştırıcıda `supabase start` ile kurulan **yerel** Supabase yığını (CI'daki database işiyle aynı yöntem).
  Supabase rolleri (anon, authenticated, service_role …) hazır gelir — `restore-drill.sh`'nin ön koşulu.
- Araçlar: PostgreSQL 17 istemcisi ve sabit rclone v1.75.2 (yedek iş akışındaki kurulum ve sürüm kapıları aynen).
- Telefondan başlatma: istek dosyası (`ops-requests/restore-drill.request`) düzenlenir **ve** GitHub ortam onayı verilir (aşağıda).

## 3. İzolasyon ve güvenlik (yapısal güvenceler)

| Risk | Önlem |
|---|---|
| Canlı Supabase'e yazma | İş **hiçbir canlı Supabase sırrı almaz**: `SUPABASE_DB_URL`, `SUPABASE_S3_*` iş akışında yoktur (testle denetlenir). Hedef yalnız `127.0.0.1` (betik yerel olmayan adresi reddeder). Canlıya yazmak yapısal olarak imkânsızdır. |
| R2'deki yedeği değiştirme | Yalnız okuma: `rclone copy` R2 → çalıştırıcı. `sync`, `delete`, `move`, `purge` yok (testle denetlenir). **Önerilen:** sahibin ayrı, yalnız **Object Read** yetkili bir R2 anahtarı açıp `RESTORE_S3_*` sırlarına koyması; mevcut yazma anahtarı kullanılmaz. |
| Müşteri verisinin herkese açık günlüğe çıkması | Betikler yalnız adım durumu ve "eşleşen tablo sayısı" yazar (kayıt sayısı/içerik yok). rclone çıktısı dosyaya gider, ekrana `rclone-log-summary.sh` özeti basılır. Storage örneğinde yol yazılmaz, yalnız "N/N SHA-256 aynı". |
| Artifact ile veri çıkışı | İş akışında `upload-artifact` **yok**, `if: failure()` hata ayıklama çıktısı yok (testle denetlenir). Dump, çalıştırıcının geçici diskinde kalır ve iş sonunda silinir. |
| İzinsiz tetikleme | (1) İstek dosyası yalnız depo yazma yetkisiyle düzenlenebilir; geliştirme oturumunun commit'leri tetiklemez. (2) İş, **`restore-drill` GitHub ortamına** bağlıdır; ortamda **zorunlu onaylayıcı = sahip**. Her çalışma sahip "Approve" demeden başlamaz. (3) Fork PR'ları sırlara erişemez. |
| Yanlış/bozuk yedek | K1 başarısızsa hiçbir şey yüklenmez; bir önceki gecenin yedeğiyle tekrarlanır (BACKUP_RESTORE.md "Tatbikat başarısız olursa"). |
| Kişisel veri saklama | Dump yalnız iş süresince bellekte/geçici diskte. Kalıcı kopya oluşmaz. KVKK açısından veri, işlemci sıfatıyla GitHub'ın geçici makinesinde birkaç dakika işlenir — sahibin kabulü gerekir (Onay kapısı 1). |

## 4. Akış (onaydan sonra yazılacak iş akışı: `elvankent-restore-drill`)

1. **Hazırlık:** PG 17 istemcisi + rclone v1.75.2 (SHA-256 doğrulamalı) + `supabase start` (yerel, studio vb. kapalı).
2. **Yedek seçimi:** R2 `db/` altındaki **en yeni** (ya da istek dosyasında yazılan) `STAMP`; dört dosya çalıştırıcıya indirilir
   (yalnız `db-<STAMP>.*`; listeleme yalnız ad, boyut yazılmaz).
3. **Veritabanı provası:** `ADMIN_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash scripts/restore-drill.sh <klasör> <STAMP>` → K1–K5, K7.
4. **Storage örneği (K6):** `storage/current/media-originals` altından rastgele N=20 dosya (ve `branding`'den 5) çalıştırıcıya indirilir,
   yerel Storage'a yüklenir, geri indirilir; SHA-256'lar karşılaştırılır. Yollar yazılmaz.
5. **Özet:** her ölçüt için TAMAM/HATA, süreler (K8). Ham çıktı yok.
6. **Temizlik:** geçici veritabanı (betik siler), indirilen dosyalar, yerel Supabase (`supabase stop --no-backup`).

## 5. Önce sentetik "kuru prova" (müşteri verisi yok)

İlk çalıştırma gerçek yedekle değil, **CI'da** yapılır: CI'nin yerel veritabanından `backup-db.sh` ile alınan sentetik (demo) yedek
aynı iş akışı adımlarıyla geri yüklenir. Bu, K1–K7 mekanizmasını müşteri verisi olmadan kanıtlar (birim + CI testi). Gerçek yedekle
çalıştırma ancak bu yeşil olduktan sonra açılır.

## 6. Onay kapıları (sırayla, her biri yazılı)

1. **Plan onayı:** "KI-24 planını onaylıyorum; müşteri verisinin GitHub'ın geçici çalıştırıcısında işlenmesini kabul ediyorum."
2. **İş akışının yazılması:** sentetik kuru prova + testler (CI yeşil) — geliştirici.
3. **Sahip ayarları:** (a) R2'de yalnız *Object Read* yetkili yeni anahtar → `RESTORE_S3_ACCESS_KEY_ID`, `RESTORE_S3_SECRET_ACCESS_KEY`
   sırları (uç nokta ve bölge mevcut `BACKUP_S3_ENDPOINT`/`BACKUP_S3_REGION` ile aynı); (b) GitHub › Settings › Environments ›
   `restore-drill` › **Required reviewers: sahip**.
4. **Gerçek prova:** sahip istek dosyasını düzenler, ardından Actions'ta **Review deployments › Approve**.
5. **Kayıt:** sonuçlar KALAN_ISLER KI-24 ve BACKUP_RESTORE.md "Doğrulama kaydı"na; 3 ayda bir tekrar.

## 7. Bu planın kapsamadığı

- Canlıya geri yükleme (asla bu iş akışıyla yapılmaz; BACKUP_RESTORE.md "Tam geri yükleme" elle ve ayrı onayla).
- Yeni bir Supabase **bulut** projesine geri yükleme (Supabase'in rol/şema/veri ayrı döküm yöntemi) — ayrı iş.
