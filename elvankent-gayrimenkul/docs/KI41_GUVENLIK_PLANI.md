# KI-41 · Canlı sırların güvenilir sınıra taşınması (plan)

> 02.11.2026 · K-63 · Durum: **plan; hiçbir sır, ortam ya da canlı ayar değiştirilmedi.** Her aşama sahibin ayrı onayıyla.
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
5. **Claude oturumları (T2):** GitHub kimliği sahiple aynı olduğu sürece teknik olarak ayrılamaz. Önlemler:
   - Production dalına doğrudan push kapalı (PR zorunlu) — Claude da dahil herkes PR açar.
   - Claude PR **birleştirmez**, ortam onayı **vermez** (sabit kural; bu belgede ve SAHIP_ADIMLARI'nda). Onay ekranında
     sahip iş akışı adını, commit'i ve değişen dosyaları kontrol eder; beklemediği bir onay isteği = durdur.
   - En güçlü seçenek (isteğe bağlı, Aşama 6): Claude oturumları için **ayrı bir GitHub hesabı** (yalnız çalışma dalına
     yazabilen); production dalında güncelleme yalnız sahibe açık; ortam onayları yalnız sahipte. O zaman T2 tamamen kapanır.

## 4. Uygulama aşamaları (her biri ayrı onay; kesinti riski ve geri dönüş)

**Aşama 1 · Kod (PR, canlıya etkisi yok).** `backup` işine `environment: uretim-yedek`; `r2-diagnose`'dan istek dosyası
tetiği kaldırılır ve ortam eklenir; envanter testi yeni duruma güncellenir. Production dalına PR ile girer.
- Etki: ortam yoksa GitHub ilk çalışmada korumasız olarak oluşturur; depo sırları hâlâ durduğu için yedek aynen çalışır.
- Kesinti riski: yok. Geri dönüş: PR'ı geri al (revert).

**Aşama 2 · Production dalı kuralı (sahip, GitHub).** `koruma` kural setine production dalı için **Require a pull request
before merging** (onay sayısı 0). Risk: doğrudan push artık reddedilir (beklenen). Geri dönüş: kuralı kapatmak.

**Aşama 3 · `uretim-yedek` ortamı (sahip).** Ortam › Deployment branches: yalnız `claude/elvankent-real-estate-platform-vxq9dj`;
ortam sırlarına yedek sırları **yeni değerlerle** (döndürme): Supabase S3 anahtarı ve R2 yedek anahtarı yeniden üretilir
(eskiler GitHub'dan geri okunamaz; döndürme zaten önerilir). DB adresi Supabase panelinden.
- Doğrulama: Actions › elvankent-backup › Run workflow › **Branch: production dalı** › yeşil; R2'de yeni `db-…` ve `storage/`.
- Kesinti riski: ortam sırrı depo sırrını gölgeler; yanlış değer yedeği kırar. Geri dönüş: hatalı ortam sırrını silmek
  (iş yeniden depo sırrına düşer) ve eski anahtarı yeni anahtar doğrulanana kadar iptal etmemek.
- Not: bundan sonra elle yedek **production dalından** başlatılır; çalışma dalından başlatılan yedek dal sınırına takılır
  (beklenen; O-5 kapısı hangi daldan olduğuna bakmaz).

**Aşama 4 · Diğer ortamlar ve depo sırlarının silinmesi (sahip).** `o5a-uygula` ve `ki23-canli-denetim` ortam sırrı olarak DB
adresi; `restore-drill` ortam sırrı olarak R2 okuma anahtarı. Sonra depo düzeyindeki hassas sırlar silinir.
- Doğrulama: (1) production dalından elle yedek yeşil, (2) çalışma dalından elle yedek **kırmızı** (dal sınırı — sınırın
  çalıştığının kanıtı), (3) ki23 denetimi onayla yeşil (salt okunur), (4) restore-drill provası yeşil, (5) ertesi gece
  zamanlanmış yedek yeşil.
- Kesinti riski: eksik taşınan sır ilgili işi durdurur (yalnız o iş; site ve Vercel etkilenmez — Vercel bu sırları kullanmaz).
  Geri dönüş: ilgili depo sırrını yeniden eklemek.

**Aşama 5 · Canlı DB'de en az yetki (canlıya yazar; runbook + yerel prova + ayrı onay).** Yedek ve denetim için yalnız
okuyabilen ayrı bir veritabanı kullanıcısı; `uretim-yedek` ve `ki23-canli-denetim` bu kullanıcının adresini alır. Tam yetkili
adres yalnız `o5a-uygula` ortamında kalır. Ardından tam yetkili parolanın döndürülmesi (eski değer depo sırrı geçmişinde
bulunduğu için). Önce yerelde: pg_dump'ın bu kullanıcıyla tüm şemaları (auth, storage dahil) eksiksiz aldığı ve
`restore-drill` ile geri yüklendiği kanıtlanır; Supabase'in rol kısıtları burada netleşir.
- Kesinti riski: eksik okuma yetkisi yedeği yarım bırakır (backup-db.sh parmak izi/tablo sayısı kontrolü yakalar).
  Geri dönüş: ortam sırrını tam yetkili adrese geri çevirmek.

**Aşama 6 (isteğe bağlı) · Claude için ayrı GitHub hesabı** (madde 3.5).

## 5. CI, yayın, yedek ve kurtarma uyumu

- **CI** (`elvankent-ci`, PR'lar): hiç sır kullanmıyor → etkilenmez.
- **Vercel yayını:** GitHub entegrasyonu ve Vercel ortam değişkenleriyle; Actions sırları kullanılmaz → etkilenmez.
- **Gece yedeği:** production dalında, `uretim-yedek` ortamıyla → çalışır (Aşama 3–4 doğrulamaları).
- **Kurtarma:** gerçek geri yükleme BACKUP_RESTORE.md'ye göre sahip tarafından elle; R2 okuma anahtarı `restore-drill` ortamında.
  Acil durumda sahip GitHub'a bağlı olmadan Supabase panelinden de bağlanabilir.
- **O-5 iş akışları:** bitti; `o5a-uygula` ortamıyla dururlar. Yeni bir canlı migration aynı ortamı kullanır.

## 6. Sahipten istenecek onaylar

Aşama 1 PR'ı (birleştirme) · Aşama 2 kuralı · Aşama 3 ortam ve anahtar döndürme · Aşama 4 sır taşıma/silme ·
Aşama 5 canlı DB kullanıcısı (runbook ile) · Aşama 6 (isteğe bağlı).
