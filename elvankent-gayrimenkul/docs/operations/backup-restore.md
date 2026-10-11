# Yedek ve geri yükleme (operasyon özeti)

Tam prosedür, komutlar ve doğrulama kayıtları: **docs/BACKUP_RESTORE.md**. Bu sayfa yalnızca
"kim, ne zaman, hangi belgeye bakar" özetidir; komutlar burada tekrarlanmaz.

| Durum | Ne yapılır | Belge |
| --- | --- | --- |
| Rutin | Günlük otomatik yedek (GitHub Actions `elvankent-backup.yml`): veritabanı dökümü + tablo parmak izi + Storage. Haftada bir iş akışının yeşil olduğunu ve son yedeğin tarihini kontrol edin | BACKUP_RESTORE.md › Otomatik günlük yedek |
| Canlı migration öncesi | Sağlayıcı yedeği (Supabase Backups/PITR) + elle `pg_dump -Fc` + Storage yedeği | DEPLOYMENT_RUNBOOK.md adım 1–2 |
| Tüm veritabanı bozuldu | Tam geri yükleme (yetkilerle birlikte; `--no-privileges` KULLANILMAZ) → `postflight_v2.sql` | BACKUP_RESTORE.md › Tam geri yükleme |
| Tek müşterinin verisi silindi / bozuldu | Kopya projeye geri yükle → yalnızca o organizasyonun satırlarını taşı (diğer müşterilere dokunma) | BACKUP_RESTORE.md › Kısmi kurtarma |
| Fotoğraf / logo kayboldu | Storage yedeğinden ilgili klasör | BACKUP_RESTORE.md › Fotoğraflar ve marka görselleri |
| Site içeriği yanlış yayınlandı | Yedek gerekmez: Site › Geçmiş › *Geri yükle* | WEB_SITESI_YONETIMI.md |

Geri yüklemeden sonra her zaman: `supabase/ops/postflight_v2.sql` (tüm satırlar TAMAM),
`/api/health` 200, bir müşteri sitesi ve paneli elle kontrol. Geri yükleme provası en az üç ayda bir
kopya projede yapılmalıdır (CI'da otomatik prova sonraki faz).
