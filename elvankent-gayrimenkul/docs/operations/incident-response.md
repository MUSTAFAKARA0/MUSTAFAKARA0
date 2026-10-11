# Olay müdahalesi ve izleme

İzleme altyapısı (hata loglama, Sentry/webhook iletimi, Speed Insights) docs/OPERATIONS.md §2'de;
burada **ne izlenir, eşik ne, sorun olunca ne yapılır** anlatılır.

## İzleme

| | Değer |
| --- | --- |
| Health endpoint | `GET https://{KARAY alan adı}/api/health` (her müşteri alan adında da aynı yanıt) |
| Beklenen durum | **200** `{"status":"ok","db":"ok","latencyMs":…,"time":…}`, `Cache-Control: no-store` |
| Hata durumu | **503** `{"status":"degraded","db":"error",…}` — veritabanına 3 sn içinde ulaşılamadı veya Supabase yapılandırılmamış |
| Ne kontrol eder | Uygulama sunucusu ayakta + veritabanı (PostgREST) anonim sorguya yanıt veriyor. Gizli bilgi, sürüm, kiracı bilgisi DÖNDÜRMEZ |
| Ne kontrol ETMEZ | E-posta sağlayıcısı, alan adı / sertifika, Storage, tek bir müşterinin sitesi |
| İzleme aracı | UptimeRobot / Better Stack (harici; KARAY hesabıyla kurulur — anahtar uydurulmadı) |
| Aralık | 5 dakika |
| Alarm eşiği | **Art arda 2 başarısız kontrol** (≈10 dk) veya yanıt süresi > 5 sn → alarm. Tek seferlik 503 alarm değildir (geçici ağ) |
| Ek kontroller (önerilen) | Her yayındaki müşteri sitesinin ana sayfası (200, anahtar kelime: firma adı) — 15 dk; sertifika bitiş uyarısı (alan adı başına) |

Yerel doğrulama kaydı (FAZ 1): sunucu + veritabanı açıkken 200 / `db: ok`; veritabanı ağ geçidi
durdurulunca 503 / `db: error`; yanıtta anahtar, URL, sürüm yok.

## Önem dereceleri

| Seviye | Örnek | Hedef ilk yanıt |
| --- | --- | --- |
| S1 | Tüm siteler / paneller kapalı; kiracı verisi başka kiracıya görünüyor; anahtar sızıntısı | Hemen |
| S2 | Tek müşterinin sitesi veya paneli kapalı; e-postalar (davet / şifre sıfırlama) gitmiyor | 4 saat |
| S3 | Tek özellik bozuk (önizleme, bir form); görsel sorun | 1 iş günü |

## Senaryolar

**Health 503 (veritabanı).** Supabase durum sayfası ve proje panelini kontrol edin (duraklatılmış
proje, bağlantı sınırı, bakım). Uygulama tarafında yapılacak değişiklik yoktur. Uzun sürerse
müşterilere bilgi verin. Veri kaybı şüphesi → [backup-restore.md](backup-restore.md).

**Health 200 ama site açılmıyor.** Vercel › Deployments (son dağıtım hatalı mı → önceki dağıtıma
*Promote*), Vercel › Logs (`"level":"error"`). Tek müşteride: organizasyon askıda mı, site durumu
"Yayında değil / Bakım" mı, alan adı *Aktif* mi ([domain-connection.md](domain-connection.md)).

**E-postalar gitmiyor.** `npm run prelaunch -- --production` (EMAIL_PROVIDER, gönderici); sağlayıcı
panelinde (Resend) gönderim logları ve alan adı (SPF/DKIM) durumu. Davetler kaybolmaz: e-posta
gönderilemezse davet "gönderilmedi" kalır, düzeldikten sonra *Daveti tekrar gönder*.

**Şüpheli erişim / kiracı sızıntısı (S1).**
1. Etkilenen ofisi KARAY konsolundan **Askıya al** (site ve panel kapanır, veri silinmez).
2. Gerekirse ilgili kullanıcıyı devre dışı bırakın; Supabase › Auth'ta oturumları sonlandırın.
3. Anahtar sızıntısı şüphesinde Supabase anahtarlarını yenileyin (service role önce), Vercel ortam
   değişkenlerini güncelleyip yeniden dağıtın.
4. Sistem kayıtları (KARAY konsolu › Sistem kayıtları) ve Supabase loglarından kapsamı belirleyin.
5. KVKK: kişisel veri ihlali varsa hukuki süreç (bildirim yükümlülüğü) için hukukçuya derhal başvurun.

**Hatalı dağıtım / migration.** Uygulama: Vercel'de önceki dağıtıma dönün. Veritabanı:
docs/PRODUCTION_MIGRATION.md › Geri dönüş (her migration dosyasının başındaki geri dönüş SQL'i).

## Kayıt

Her olay için organizasyon sayfasındaki **KARAY notları**na (müşteriye özelse) veya ekip kanalına:
başlangıç / bitiş saati, etki, kök neden, alınan önlem.
