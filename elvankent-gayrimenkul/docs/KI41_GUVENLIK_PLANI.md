# KI-41 · Canlı sırların güvenilir sınıra taşınması (plan)

> 02.11.2026 · K-63 · Durum: **plan; hiçbir sır, ortam ya da canlı ayar değiştirilmedi.** Her aşama sahibin ayrı onayıyla.
> Bağımsız güvenlik incelemesi (02.11) bulguları §7'de; plan buna göre düzeltildi.
> **İlerleme:** Aşama 0 ✓ (sahip, 02.11: `uretim-yedek` ortamı, dal sınırı). Aşama 1 kodu çalışma dalında (K-64); production'a PR ile.
> Depo herkese açıktır: burada sır değeri, adres ya da kimlik yazılmaz.

## 1. Bugünkü durum (kanıt: `.github/workflows/*`, `tests/unit/workflow-secrets.test.mjs`)

| İş akışı | Tetik | Onay ortamı | Hassas sırlar | Ne yapar |
| --- | --- | --- | --- | --- |
| `elvankent-backup` | gece (varsayılan dal) + elle | **yok** | canlı DB adresi, Supabase Storage S3 anahtarı, R2 yedek anahtarı | pg_dump + Storage → R2, saklama süresi dolanı siler |
| `elvankent-r2-diagnose` | elle + istek dosyası (çalışma dalı) | **yok** | R2 yedek anahtarı, Supabase Storage S3 anahtarı | R2 bağlantı teşhisi (iş bitti) |
| `elvankent-restore-drill` | elle + istek dosyası | `restore-drill` | R2 okuma anahtarı | yedeği test sunucusuna geri yükler (canlıya değil) |
| `elvankent-ki23-canli-denetim` | elle + istek dosyası | `ki23-canli-denetim` (onaylı) | canlı DB adresi | salt okunur şema denetimi |
| `elvankent-o5a/b/c-uygula` | yalnız istek dosyası push'u | `o5a-uygula` (onaylı, dal sınırlı) | canlı DB adresi | canlıya migration yazar (O-5 bitti) |
| `elvankent-ci`, `o4-*`, `security-candidate`, `uretim-saglik` | push / PR | — | **yok** | test, derleme |

Hassas sırların hepsi **depo düzeyinde**. Canlı DB adresi tam yetkili kullanıcıyla (yazma, şema değiştirme).
Gece yedekleri varsayılan daldan; elle yedekler (#47, #50–#53) çalışma dalından başlatılmış.

## 2. Tehdit modeli

| # | Tehdit | Bugün | Neden |
| --- | --- | --- | --- |
| T1 | Herhangi bir daldaki push, yeni/değişmiş bir iş akışıyla depo sırlarını alır | **açık** | Depo sırları her daldaki her işe verilir; push edilen commit'in iş akışı dosyası çalışır. Onay ortamı, "yalnız sahip" ve tek kullanım kontrolleri aynı dosyada olduğu için silinebilir |
| T2 | Sahip adına çalışan Claude oturumları | **açık** | Claude'un push'ları GitHub'da sahibin kullanıcı adıyla görünür (CI #194: actor = sahip). `github.actor == owner` Claude'u ayırmaz; "Claude-Session:" işareti bir kuraldır, denetim değildir |
| T3 | Yedeklerin silinmesi | **açık** | R2 yedek anahtarı yazma + silme yetkili (saklama temizliği için); T1 ile yedekler silinebilir. Supabase S3 anahtarı canlı fotoğrafları silebilir |
| T4 | Onay ortamının kendisi | kısmen | Onay insan eylemidir (tek gerçek sınır); ama sır depo düzeyinde olduğu için ortamı kaldıran bir iş akışı onaysız sır alır (T1) |
| T5 | Zorla gönderim / dal silme ile eski commit'lerin oynatılması | **kapandı** | 02.11 `koruma` kural seti (sahip) + KI-40 sıkı tetik |
| T7 | Yedek değişkenleriyle yedek silme | **kısmen kapandı (kod)** | `BACKUP_RETENTION_DAYS` depo değişkeni 0'a çekilip production dalından elle yedek başlatılırsa tüm DB yedekleri silinebilirdi; 02.11'de en az 14 gün sınırı eklendi. Kalıcı çözüm R2 kova kilidi (Aşama 3b) |
| T8 | Sahte "taze yedek" | **kapandı (kod)** | O-5 kapısı, yedek kapalıyken de "success" biten koşuyu sayıyordu; artık gerçek `backup` işinin başarısı aranıyor |
| T6 | Fork / dış katkı | kapalı | PR iş akışları sır kullanmıyor (test bunu sabitler); depoda tek yazma yetkili kişi var |

## 3. Hedef mimari (güvenilir sınır)

1. **Depo düzeyinde hassas sır kalmaz.** Her sır yalnız onu kullanan ortamın sırrıdır. GitHub ortam sırrını işe yalnız
   ortamın koruma kuralları geçildikten sonra verir (dal sınırı → onay); iş akışı dosyasını değiştirmek bunu aşamaz:
   ortamı anmayan iş sırrı hiç almaz, anan iş kurallara takılır.
2. Ortamlar:

| Ortam | Dal sınırı | Onay | Sırlar | Kullanan |
| --- | --- | --- | --- | --- |
| `uretim-yedek` (yeni) | **yalnız varsayılan (production) dal** | yok (gece kendiliğinden çalışmalı) | DB adresi (Aşama 5'te salt okunur kullanıcı), Supabase S3, R2 yedek | `backup` |
| `o5a-uygula` | çalışma dalı (✓ yapıldı) | sahip (✓) | canlı DB adresi (yazma) | o5a/b/c |
| `ki23-canli-denetim` | çalışma dalı | sahip (✓) | DB adresi (Aşama 5'te salt okunur) | ki23 |
| `restore-drill` | çalışma dalı | sahip | R2 okuma anahtarı | restore-drill |

3. **Gözetimsiz çalışan tek iş (gece yedeği) yalnız production dalındaki kodu çalıştırır.** Production dalına kod yalnız PR
   birleştirmesiyle girer (Aşama 2'deki kural); PR'ı sahip birleştirir. Böylece yedek sırlarını alan kod, sahibin gördüğü
   bir PR'dan geçmiş olur.
4. `r2-diagnose` emekliye ayrılır (R2 sorunu çözüldü, #48–#53 yeşil); gerekirse `uretim-yedek` ortamıyla yalnız elle.
5. **Claude oturumları (T2) — açık söylemek gerekir: Aşama 6'ya kadar GitHub tarafında Claude'u sahipten ayıran hiçbir
   teknik denetim yoktur.** Claude sahibin kimliğiyle push eder; sahip adına PR açıp birleştirebilecek, iş akışı tetikleyebilecek
   araçlara sahiptir. "PR zorunlu (0 onay)" kuralı da buna karşı koruma değildir (aynı kimlik açar ve birleştirir); "1 onay"
   ya da ortamda "Prevent self-review" ise tek kişilik depoda sahibi kilitler. "Claude birleştirmez / onay vermez" bir
   **kuraldır, denetim değildir.** Bu yüzden:
   - **Aşama 6 (Claude için ayrı GitHub hesabı) T2'yi kapatmak için ZORUNLUDUR.** Ayrı hesap yalnız yazma yetkili (yönetici
     değil); production dalında kural seti "Restrict updates", atlatma yetkisi yalnız sahipte; ortam onaycısı yalnız sahip.
   - O zamana kadar: kural setinde atlatma listesi (bypass) boş olmalı; Claude GitHub uygulamasının izinleri gözden geçirilir
     (dağıtım onayı, yönetim, sır/değişken/ortam yazma, birleştirme gerekmiyorsa kaldırılır); sahip birleştirmeyi yalnız web
     arayüzünden yapar; kendisinin başlatmadığı bir PR birleştirmesi ya da ortam onayı isteği görürse durdurur.

## 4. Uygulama aşamaları (her biri ayrı onay; kesinti riski ve geri dönüş)

**Aşama 0 · Ortamı önce elle kur (sahip).** `uretim-yedek` ortamı GitHub'da elle oluşturulur ve **önce** dal sınırı kaydedilir
(Selected branches, tam ad `claude/elvankent-real-estate-platform-vxq9dj`; joker yok, etiket kuralı yok, "Protected branches
only" değil). Sır eklenmez. Böylece Aşama 1'deki iş ortamı korumasız otomatik oluşturmaz. Kesinti riski: yok.

**Aşama 1 · Kod (küçük PR, canlıya etkisi yok).** Production dalından açılan **ayrı ve küçük** bir dal (çalışma dalı production'ın
çok önünde; ondan açılan PR ilgisiz kodu da yayına taşır): `backup` işine `environment: uretim-yedek`; `r2-diagnose` silinir;
yedek değişkenleri (`BACKUP_BUCKET`, `BACKUP_S3_PROVIDER`, `BACKUP_RETENTION_DAYS`) ortam değişkeni olabilir (ortam değeri depo
değerini gölgeler); **`ELVANKENT_BACKUP_ENABLED` depo değişkeni kalır** — iş düzeyindeki `if` ortamdan önce değerlendirilir, ortama
taşınırsa yedek işi hiç çalışmaz (kapalıysa `backup-disabled` uyarısı görünür; O-5 kapısı da gerçek yedek işini arar). R2 teşhisi
silinmek yerine yalnız elle + ortamda bırakıldı;
envanter testi yeni duruma. Depo sırları dururken yedek aynen çalışır.
- Kesinti riski: yok (CI ve Vercel bu sırları kullanmaz). Geri dönüş: geri alma PR'ı.

**Aşama 2 · Production dalı kuralı (sahip, GitHub).** `koruma` kural setine production dalı için **Require a pull request
before merging** (onay sayısı 0). Risk: doğrudan push artık reddedilir (beklenen). Geri dönüş: kuralı kapatmak.

**Aşama 3 · `uretim-yedek` sırları (sahip; Aşama 4 ile aynı oturumda).** Ortam sırlarına yedeğin 9 sırrı, ortam değişkenlerine
4 yedek değişkeni; sırlar **yeni değerlerle** (döndürme): Supabase S3 anahtarı ve R2 yedek anahtarı yeniden üretilir
(eskiler GitHub'dan geri okunamaz; döndürme zaten önerilir). DB adresi Supabase panelinden.
- Doğrulama: Actions › elvankent-backup › Run workflow › **Branch: production dalı** › yeşil; R2'de yeni `db-…` ve `storage/`.
- Kesinti riski: ortam sırrı depo sırrını gölgeler; yanlış değer yedeği kırar. Geri dönüş: hatalı ortam sırrını silmek —
  iş yeniden depo sırrına düşer; **yalnız Aşama 4'ten önce ve eski anahtar sağlayıcıda henüz iptal edilmemişse** geçerli.

**Aşama 3b · Yedeklerin silinemezliği (sahip, Cloudflare).** R2 kovasında `db/` öneki için saklama kilidi (bucket lock) ve
süresi dolanların R2 yaşam döngüsü kuralıyla silinmesi; ardından iş akışındaki `rclone delete …/db` kaldırılır (kod, PR).
Böylece yedek anahtarı ele geçse bile DB yedekleri silinemez. Supabase S3 anahtarının salt okunur türü yoktur; tek koruması ortamdır.
- Not: bundan sonra elle yedek **production dalından** başlatılır; çalışma dalından başlatılan yedek dal sınırına takılır
  (beklenen; O-5 kapısı hangi daldan olduğuna bakmaz).

**Aşama 4 · Diğer ortamlar, depo sırlarının silinmesi, eski anahtarların iptali (sahip).** Her ortamın tam listesi:
- `o5a-uygula`, `ki23-canli-denetim`: `SUPABASE_DB_URL`.
- `restore-drill`: `RESTORE_S3_ACCESS_KEY_ID`, `RESTORE_S3_SECRET_ACCESS_KEY` **ve** `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`
  (iş akışı bunları da okur) + değişkenler `BACKUP_BUCKET`, `BACKUP_S3_PROVIDER`.
- `uretim-yedek`: 9 sır + 4 değişken (Aşama 3).
Sonra depo düzeyindeki hassas sırlar silinir; doğrulamadan hemen sonra **eski Supabase S3 ve R2 anahtarları sağlayıcıda iptal
edilir** ve **tam yetkili veritabanı parolası döndürülür** (yeni adres yalnız ortam sırlarına).
- Doğrulama: (1) production dalından elle yedek yeşil, (2) çalışma dalından elle yedek **kırmızı** (dal sınırı — sınırın
  çalıştığının kanıtı), (3) ki23 denetimi onayla yeşil (salt okunur), (4) restore-drill provası yeşil, (5) ertesi gece
  zamanlanmış yedek yeşil.
- Kesinti riski: eksik taşınan sır ilgili işi durdurur (yalnız o iş; site ve Vercel etkilenmez — Vercel bu sırları kullanmaz).
  Geri dönüş: ilgili depo sırrını yeniden eklemek.

**Aşama 5 · Canlı DB'de en az yetki (canlıya yazar; runbook + yerel prova + ayrı onay).** Doğrulanacaklar: `pg_read_all_data`
RLS'yi aşmaz — pg_dump `row_security=off` ister, rol BYPASSRLS gerektirir (bunu verebilmek için mevcut kullanıcının yetkisi);
auth/storage/realtime/vault/pgsodium/cron şemalarındaki her tablonun okunabildiği; oturum kipinde bağlantı (işlem kipi havuz
`--snapshot`'ı bozar); PUBLIC'e açık SECURITY DEFINER fonksiyonlar (salt okunur rol bunlarla yazabilir); kabul: parmak izi ve
tablo sayıları tam yetkili dökümle aynı, restore-drill bütünlük ve şema TAMAM. Yedek ve denetim için yalnız
okuyabilen ayrı bir veritabanı kullanıcısı; `uretim-yedek` ve `ki23-canli-denetim` bu kullanıcının adresini alır. Tam yetkili
adres yalnız `o5a-uygula` ortamında kalır. Ardından tam yetkili parolanın döndürülmesi (eski değer depo sırrı geçmişinde
bulunduğu için). Önce yerelde: pg_dump'ın bu kullanıcıyla tüm şemaları (auth, storage dahil) eksiksiz aldığı ve
`restore-drill` ile geri yüklendiği kanıtlanır; Supabase'in rol kısıtları burada netleşir.
- Kesinti riski: eksik okuma yetkisi yedeği yarım bırakır (backup-db.sh parmak izi/tablo sayısı kontrolü yakalar).
  Geri dönüş: ortam sırrını tam yetkili adrese geri çevirmek.

**Aşama 6 · Claude için ayrı GitHub hesabı — T2 için zorunlu** (madde 3.5).

**Durum (11.11.2026, salt okunur denetim):** Aşama 0 ve 1 tamam (production `d6113e6`; gece yedekleri #54–#62 yeşil). Aşama 2
**açık**: `koruma` kural seti yalnız silme ve zorla push'u engelliyor, PR zorunluluğu yok; `koruma` eski çalışma dalını da kapsadığı
için PR kuralı ayrı bir kural setiyle (`uretim-pr`, yalnız production) eklenir — adımlar [PILOT_YAYIN_GO_NOGO.md](PILOT_YAYIN_GO_NOGO.md) §2.1.
Aşama 3, 3b, 4, 5, 6 açık. Hiçbir iş akışı depoya push etmediği için PR zorunluluğu otomasyonu etkilemez.
**14.11:** Aşama 2 ✓ (sahip; `uretim-pr` etkin, onay 0; `koruma` geliştirme dalını kapsıyor). Aşama 3–4 adım adım uygulama planı: [KI41_ASAMA_3_4_UYGULAMA.md](KI41_ASAMA_3_4_UYGULAMA.md).

## 5. CI, yayın, yedek ve kurtarma uyumu

- **CI** (`elvankent-ci`, PR'lar): hiç sır kullanmıyor → etkilenmez.
- **Vercel yayını:** GitHub entegrasyonu ve Vercel ortam değişkenleriyle; Actions sırları kullanılmaz → etkilenmez.
- **Gece yedeği:** production dalında, `uretim-yedek` ortamıyla → çalışır (Aşama 3–4 doğrulamaları).
- **Kurtarma:** gerçek geri yükleme BACKUP_RESTORE.md'ye göre sahip tarafından elle; R2 okuma anahtarı `restore-drill` ortamında.
  Acil durumda sahip GitHub'a bağlı olmadan Supabase panelinden de bağlanabilir.
- **O-5 iş akışları:** bitti; `o5a-uygula` ortamıyla dururlar. Yeni bir canlı migration aynı ortamı kullanır.

## 6. Sahipten istenecek onaylar

Aşama 1 PR'ı (birleştirme) · Aşama 2 kuralı · Aşama 3 ortam ve anahtar döndürme · Aşama 4 sır taşıma/silme ·
Aşama 5 canlı DB kullanıcısı (runbook ile) · Aşama 6 (T2 için zorunlu).

## 7. Bağımsız güvenlik incelemesi (02.11) ve yapılanlar

| Bulgu | Önem | Karşılık |
| --- | --- | --- |
| H1 "PR zorunlu" Claude'u ayırmaz; T2 Aşama 6'ya kadar açık | yüksek | §3.5 açıkça yazıldı; Aşama 6 zorunlu |
| H2 Yedek değişkenleriyle tüm DB yedeklerinin silinmesi | yüksek | **kod:** saklama en az 14 gün (test: KI-41 H2); değişkenler ortama (Aşama 1); R2 kilidi (Aşama 3b) |
| H3 Aşama 4 restore-drill'i kırardı (uç nokta/bölge de okunuyor) | yüksek | Aşama 4 ortam listesi düzeltildi |
| H4 Depo sırları Aşama 4'e kadar her dalda; eski değerler geçerli kalıyor | yüksek | Aşama 3–4 tek oturumda; eski anahtar iptali ve DB parolası döndürme Aşama 4'te |
| M1 Ortam otomatik oluşturma; dal sınırı biçimi; olay türleri | orta | Aşama 0; tam dal adı; test: `pull_request_target` yok, ortamlı iş akışları `workflow_run`/`workflow_call`/`pull_request` ile tetiklenmez |
| M2 O-5 yedek kapısı "yedek kapalı" koşusunu sayıyordu | orta | **kod:** gerçek `backup` işinin başarısı aranıyor (KT-15) |
| M3 Aşama 1 PR'ı çalışma dalından açılırsa ilgisiz kod yayına çıkar | orta | Aşama 1 production dalından küçük dal |
| M4 Salt okunur rol tuzakları | orta | Aşama 5 doğrulama listesi |
| L3 Elle yedek yalnız production dalından | düşük | Aşama 3 notu; SAHIP_ADIMLARI'na Aşama 3 ile eklenecek |
| L4 Acil durum: R2 okuma anahtarı ve DB parolası GitHub dışında da saklanmalı | düşük | Sahip: parola yöneticisi |
| L5 60 gün etkinliksizlikte zamanlanmış yedek kapanır | düşük | Kaçan yedek uyarısı (izleme) ayrı iş |
