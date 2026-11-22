# Sahibin yapacakları · güncel sıra (14.11.2026)

> Değerleri (anahtar, şifre, bağlantı adresi) **kimseye yazmayın**, bana da göndermeyin. Bana "tamam", çıktı özeti ya da değer
> görünmeyen ekran görüntüsü yeter. Önceki sürüm (31.10) git geçmişinde; oradaki A bölümü (gece yedeği kurulumu) ve O-4 / PR #3
> yayınları tamamlandı.

## Güncel sıra · pilot ofis (14.11.2026)

Ayrıntı ve gerekçe: [PILOT_YAYIN_GO_NOGO.md](PILOT_YAYIN_GO_NOGO.md). Her canlı adım ayrı onaydır; değerleri bana yazmayın.

| # | Ne | Nerede | Süre | Canlıya etkisi |
|---|---|---|---|---|
| 1 ✓ | (14.11 tamam) KI-41 Aşama 2: `uretim-pr` kural seti (production'a PR zorunlu) + `koruma`'ya geliştirme dalını ekleme | GitHub › Settings › Rules (GO_NOGO §2.1) | 5 dk | Yok |
| 2 | Hukuki/ticari işleri **paralel** başlatmak: avukat (taraf, pilot sözleşmesi + DPA, yurt dışı aktarım, metinler, EİDS) ve D-11 plan kararı | GO_NOGO §6 | günler | Yok |
| 3 | Canlı şema doğrulaması (salt okunur): `supabase/ops/canli_sema_tespiti.sql` ve beş `01_preflight.sql` (`media_size_guard`, `tenant_member_guard`, `license_no`, `pilot_trial_end`, `org_setup`); çıktıyı bana iletin | Supabase › SQL Editor | 15 dk | Yok (yalnız okur) |
| 4 | A7 Sentry deneme olayına onay ("A7 deneme olayına onay veriyorum") | bana yazılı | 10 dk | Tek deneme isteği |
| 5 | Kod yayını: PR'ın açılmasına onay → CI yeşil → taze yedek → birleştirme | GitHub (GO_NOGO §4.1) | 30 dk | Production yayını; geri dönüş Vercel › Promote |
| 6 | Migration'lar F → E → G → H → I (her biri: taze yedek, 01→04, kabul testi) | Supabase › SQL Editor (runbook README) | her biri 20 dk | Canlı şema; her birinin `05` geri dönüşü var |
| 7 | KI-41 Aşama 3–4: yedek sırlarını ortamlara taşıma, anahtar döndürme, depo sırlarını silme (migration'larla aynı gün değil) | [KI41_ASAMA_3_4_UYGULAMA.md](KI41_ASAMA_3_4_UYGULAMA.md) | 1 saat | Yedek işi; site etkilenmez |
| 8 | Vercel Pro ve Supabase Pro'yu etkinleştirmek (ücretli; karar 2'de) | Vercel, Supabase faturalama | 15 dk | Yok |
| 9 | Pilot günü: sözleşme imzalı ve 1–8 tamamsa ofisi açmak | `operations/customer-onboarding.md` §0 | 1 saat + DNS | Gerçek ofis ve veri |

## Geçmiş kayıt (02.11 ve öncesi)

## Tamamlananlar (kanıtıyla)

| İş | Kanıt |
| --- | --- |
| Gece yedeği kurulumu (sırlar, R2 kovası, değişkenler) | Elle yedek #47 ve #48 başarılı (varsayılan daldan #48, 01.11) |
| O-4 güvenlik yaması + KARAY-01 + PR #3 yayını | Production `a0f0a67` (01.11) |
| D-04 / D-05 ana kararları | Karar kaydı 01.11 (alt kararlar aşağıda açık) |
| KI-23 canlı şema tespiti | 21 migration var, 10 eksik (CSV, 01.11) |
| KI-23 canlı şema ve güvenlik denetimi | Actions #8 (02.11): G1–G4 TAMAM; 751 nesne AYNI; 77 fonksiyonun farkı **yalnız satır sonu biçimi** (başlık 77/77, CR'siz gövde 77/77 AYNI) → "TAMAM (biçim farkı)" |
| KI-24 hazırlığı | R2 okuma anahtarı (`RESTORE_S3_*`) ve `restore-drill` ortam onayı tanımlandı |
| PR #2 | Kapalı |

## Sizin yapacaklarınız (güncel, 02.11 K-61)

Tamamlananlar (02.11): O-5 Aşama 1–4 canlıda ve doğrulandı · tam kod (PR #4) ve tanıtım videosu (PR #5) yayında · Sentry bağlandı ·
`VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` tanımlandı · onay kuralları · O-6 · D-13 (müşteri siteleri kendi alan adlarıyla) ·
Mission Control PR #4/#5 ve APK #13

### 1. KARAYS alan adı ✓ (02.11 K-61) — alındı, siteye bağlandı, sahip kontrol etti

### 2. E-posta gönderimi ✓ (02.11 K-60) — Resend doğrulandı, şifre sıfırlama e-postası test edildi

### 2a. GitHub güvenlik ayarları (KI-41; 02.11 bağımsız güvenlik incelemesi) — ~5 dk
1. https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/settings/rules › **New ruleset › New branch ruleset**.
   Ad: `koruma`; **Enforcement status: Active**; **Target branches › Add target › Include by pattern**:
   `claude/karays-mission-control-vn8g65` ve `claude/elvankent-real-estate-platform-vxq9dj`.
   Kurallar: **Restrict deletions** ✓, **Block force pushes** ✓ (diğerlerine dokunmayın) › **Create**.
2. https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/settings/environments › **o5a-uygula** ›
   **Deployment branches and tags › Selected branches and tags › Add rule**: `claude/karays-mission-control-vn8g65` › kaydet.
3. Veritabanı adresinin onay ortamına taşınması yedek iş akışını da etkilediği için ayrı bir planla yapılacak (Claude hazırlar).

### 3. Elvankent alan adı — önce müşteriyle görüşün
Onay sonrası konsol › Web Siteleri › Elvankent › Domain ekranındaki DNS kayıtları müşteriye iletilir.

### 4. Altyapı planları (D-11, ücretli; karar sahipte)
Vercel Pro (Hobby ticari kullanıma kapalı) · Supabase Pro (günlük platform yedeği). Fiyatları sayfada teyit edin.

### 5. Avukat ve mali müşavir — [KARAR_ARASTIRMA_PAKETI.md](KARAR_ARASTIRMA_PAKETI.md) soru listesi

### 6. Sonraya bırakılanlar
Sentry deneme olayı · tanıtım videosu Türkçe seslendirmesi ([metin](KARAYS_TANITIM_SESLENDIRME.md)).

## Benim yapacaklarım (onay gerektirmeyen)
- Gece yedeğini izlemek ve sonucu yazmak.
- Köken çıktısı ve KI-24 sonucunu okuyup O-5a engelinin kalkıp kalkmadığını raporlamak (KI23 belgesi §2.7).
- O-5a için uygulama yöntemini hazırlamak: telefonda donmayan, onaylı ve geri dönüşü tanımlı bir yol (bilgisayar adımları ya da
  sahip tetiklemeli yazma iş akışı) — taslak, çalıştırılmadan sunulur.
- KALAN_ISLER ve günlüğü güncel tutmak.

## O-5a çalıştırma (onay verildi; iş akışı CI'dan geçince)

1. Taze yedek (son 3 saat içinde olmalı; yedek **bitip yeşil olmadan** O-5a'yı tetiklemeyin): https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/workflows/elvankent-backup.yml
   › Run workflow (varsayılan dal) › yeşil olmasını bekleyin.
2. İstek dosyası: https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/edit/claude/karays-mission-control-vn8g65/elvankent-gayrimenkul/ops-requests/o5a-uygula.request
   › son satırı tam olarak `CALISTIR=evet` yapın › Commit changes.
3. https://github.com/MUSTAFAKARA0/MUSTAFAKARA0/actions/workflows/elvankent-o5a-uygula.yml › en üstteki çalışma › Review deployments › Approve.
4. Sonuç "SONUÇ: TAMAM" olmalı; bana iletin. Ardından satırı yeniden `# CALISTIR=evet` yapıp kaydedin.
5. Duman testi (tarayıcıdan): KARAYS sayfasında "Bilgi al" formuyla kendinize bir deneme talebi → KARAY konsolu › Talepler; konsol
   ana sayfası ve Müşteriler listesi açılıyor mu; bir kiracı sitesi ve ofis paneli açılıyor mu.
