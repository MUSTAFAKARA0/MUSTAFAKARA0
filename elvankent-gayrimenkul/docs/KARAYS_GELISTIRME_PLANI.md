# KARAYS · Satılabilir ürün iş listesi (tek, kanıtlı, önceliklendirilmiş)

> 08.11.2026 · dal `claude/karays-refocus-t84k81` · production `d6113e6` (PR #6, 03.11) · canlı DB 39 migration.
> Girdiler: güncel kod ve commit geçmişi (bu oturumda okundu), [KALAN_ISLER.md](KALAN_ISLER.md) KI-01…KI-45,
> [PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md) D-01…D-20, iki dış rapor (05.11.2026):
> **R35** "Uçtan uca sistem ve güvenlik denetimi" (F01–F30) ve **R84** "Strateji • eksikler • hukuk • ticari açılış"
> (R84'ün ikinci yarısı R35'in aynısıdır; özgün kısmı 8 kapı, backlog kodları ve hukuk taslak paketi).
> **Kural:** güncel kod esastır. Raporlardan sonra (05.11) kapanan iş yeniden yapılmaz. Hukuki/ticari karar gerektiren hiçbir iş
> "tamamlandı" sayılmaz.

## 0. Mission Control (08.11 sahip kararı)

Mission Control mevcut hâliyle yalnız izleme aracı. A6 sonrası özellik, APK, pano, ajan paneli, token analitiği, ECC ajan sayısında
değişiklik ve MC sprinti yok. Mevcut kod ve commit'ler korunur. İstisna: gerçek güvenlik sorunu ya da aracı tamamen durduran hata.

## 1. Onay kuralı

Claude bu dalda kod, test, bekleyen migration **dosyası**, runbook ve belge yazar. **Ayrı sahip onayı** gerekenler: production
yayını, PR birleştirme, canlı veritabanına migration, canlı veriye dokunan iş akışı, sır/ortam değişikliği.

## 2. Rapor bulgularının sınıflandırması (güncel kodla karşılaştırıldı)

Sınıflar: **A** tamamlanmış ve doğrulanmış · **B** kodda düzeltilmiş, canlı doğrulaması eksik · **C** gerçekten açık, yapılmalı ·
**D** sahibin ticari/hukuki kararını bekliyor · **E** uzun vadeli ürün geliştirmesi.

| Rapor | Bulgu | Sınıf | Güncel kanıt / not | Plandaki iş |
|---|---|---|---|---|
| R35 F01 · R84 KI-41 | GitHub sırlarının güven sınırı | **C + D** | Aşama 0–1 ✓ (PR #6, gece yedekleri `uretim-yedek` ortamında #54–#58 yeşil). Depo düzeyinde tam yetkili DB adresi ve S3/R2 anahtarları hâlâ duruyor; Aşama 2–6 sahibin GitHub/Cloudflare/Supabase adımları | P0-2 |
| R35 F02 · R84 KI-42 | Bildirilen boyutla kota atlama | **C** | Kodda düzeltme yoktu (bu oturumda kontrol edildi: `media_storage_slot_guard` boyut denetlemiyor) | **P0-1 (başladı)** |
| R35 F03 · R84 OPS-02 | Abonelik limitleri fail-open | **D** (kod hazır) | Bayraklı düzeltme canlıda (Aşama 3, bayrak `false`); açmak D-04/D-05 alt kararlarına ve aboneliksiz aktif ofis incelemesine bağlı (KI-31) | P0-6 |
| R35 F04 · R84 DR-01 | Gerçek yedekle geri yükleme yok | **A** | Rapor eskimiş: restore-drill #2 (02.11, K-42) gerçek yedek `db-2026-11-01T1549Z`, BÜTÜNLÜK TAMAM 17/17 + 72/72, Storage K6 23/23, ≈2 dk. Sonraki prova 3 ayda bir | P0-10 (takvim) |
| R35 F05 | Vercel Hobby ticari kullanıma kapalı | **D** | Sahip kararı (D-11); Supabase Free'de platform yedeği/PITR yok (31.10 kanıtı) | P0-4 |
| R35 F06 · R84 KVKK-01 | Aydınlatma ile açık rıza aynı kutuda | **B + D** | `84c60e9`, `4eb6e17`, `c204cad` (07.11): KARAYS formunda aydınlatma/rıza ayrımı, analitik yalnız onayla, onay geri çekme; **production'da değil**, avukat onayı yok | P0-5 |
| R35 F07 · R84 EİDS-01 | EİDS / yetki belgesi | **C + D** | Kodda yetki belgesi alanı yok (kontrol edildi); EİDS kapsamı avukat görüşü (D-20) | P0-8 |
| R35 F08 · R84 BILL-01 | Faturalama/tahsilat yolu kararsız | **D** | D-01/D-02/D-03/D-07/D-08 bekliyor | P0-6, P0-7 |
| R35 F09 | `platform_customer_overview` canlıda yok | **A** | O-5a canlıda (02.11, K-45: 30/30 VAR) + duman testi (konsol ana sayfa, Müşteriler). İsteğe bağlı: Vercel hata kaydının 48 saat temiz olduğuna bakılır | — |
| R35 F10 | CSP `*.supabase.co` jokeri | **C** (önizleme engelli) | KI-32; gerçek Supabase'e bağlı önizleme gerekiyor | P1-2 |
| R35 F11 | HSTS prod denetimi | **B** | `1deed8d` (07.11): KARAYS alan adlarında includeSubDomains/preload, kiracı alan adlarında düz max-age; production'da değil | P1-2 |
| R35 F12 · R84 PERF-01 | Gerçek CWV ölçümü yok | **C** | KI-35; Speed Insights yalnız onayla çalışıyor | P1-1 |
| R35 F13 | İstemci hata ucu hız sınırı süreç içi | **C** | `/api/monitoring` süreç içi Map; dağıtık sınır yok | P1-8 |
| R35 F14 · R84 KI-43 | Temizlikte süre bütçesi | **A** | Canlıda doğrulandı (03.11, K-65, PR #6) | — |
| R35 F15 · R84 KI-44 | Başarısız yüklemede tekrar deneme çıkmazı | **A** | Canlıda doğrulandı (03.11, K-65) | — |
| R35 F16 · R84 KI-45 | 50 fotoğraf sınırı yarışı, replaceId | **B + C** | `302b6d1`, `c204cad` (07.11): replaceId yükleme bileti ile bağlı, sınır sonlandırmada yeniden denetleniyor, döndürme/silme E2E; production'da değil. Açık: sayım atomik değil (migration gerekir), ek sürüm klasörü | P1-3 |
| R35 F17 | RTO/RPO sözleşmede yok | **D** | Prova ölçümü var (≈2 dk geri yükleme, RPO ≤ 24 saat gece yedeği); taahhüt sahip/sözleşme kararı | P1-6 |
| R35 F18 | R2 yedekleri silinemez değil | **C + D** | KI-41 Aşama 3b (Cloudflare kova kilidi, sahip); 14 gün saklama alt sınırı kodda ✓ | P0-10 |
| R35 F19 | Elvankent alan adı DNS geçişi | **D** | Müşteri görüşmesi bekliyor (SAHIP_ADIMLARI §3) | P0-9 |
| R35 F20 · R84 QA-01 | Deneme/aktivasyon politikası, onboarding provası | **C + D** | Konsol sihirbazı + davet var; uçtan uca prova ve açılış runbook'u yok; D-01…D-03/D-06 kararsız | P0-9 |
| R35 F21 | Gerçek telefon ve erişilebilirlik | **C** | `TELEFON_KABUL_TESTI.md` gerçek cihaz bekliyor | P1-4 |
| R35 F22 | Tam veri ayrılış paketi (medya+CRM) | **C** | Yalnız CSV dışa aktarma; D-05 ile birlikte | P1-9 |
| R35 F23 | Depo herkese açık | **D** | D-12 sahip kararı; gitleaks CI'da | — |
| R35 F24 · R84 SUP-01 | Olay sorumlusu, yanıt süresi | **D** | D-18 | P1-6 |
| R35 F25 · R84 SEO-01 | Gerçek index/Search Console verisi | **E** | Teknik SEO altyapısı var; ilk gerçek ofis alan adından sonra | P2 |
| R35 F26 | Webhook imza/replay/idempotency | **C** (sağlayıcıdan bağımsız kısım) | D-09 ilkeleri yazılı; kod yok | P0-7 |
| R35 F27 | Talep e-postası teslim oranı | **C** | Resend teslim durumu geri bildirimi yok; panel kaydı e-postadan bağımsız | P1-5 |
| R35 F28 | Gelişmiş bot trafiği ölçümü | **E** | Honeypot, süre, IP özeti, DB limiti var | P2 |
| R35 F29 · R84 KV-06 | Silme talebi ↔ yedek saklama | **D** | D-05/D-10 saklama süresi hukuki görüş; teknik tasarım karardan sonra | P0-5 |
| R35 F30 · R84 CONV-01 | Olayları iş KPI'larına bağlama | **E** | İlan başına görüntüleme/WhatsApp/telefon sayılıyor | P2-2 |
| R84 KVKK-02 | Yurt dışı aktarım, alt işleyen envanteri, m.9 | **D** | Taslak yasal sette alt işleyen listesi; standart sözleşme imzası + 5 iş günü bildirimi sahibin | P0-5 |
| R84 LEGAL-01 · OWN-01 · D-19 | Gerçek satıcı/unvan, kod ve marka hakkı, sahibin statüsü | **D** | "KARAYS Gayrimenkul Teknolojileri" kayıtlı unvan değil; yazılı hukuk + vergi görüşü | P0-5 |
| R84 SOC-01 | Pazarlama izni / İYS | **D + E** | Tanıtım iletisi gönderimi yok; başlamadan önce İYS süreci | — |
| R84 DESIGN-01 | Tema kalite kapısı (görsel fark + a11y) | **E** | — | P2 |
| R84 PROD-01 · fikir #4 | Alıcı arama profili + izinli alarm | **E** | — | P2-1 |
| R84 fikir #1/#2/#5 | Talep sıcaklık panosu, satıcı kazanım sayfası, portföy raporu | **E** | Pilot ölçümüne bağlı | P2 |
| R84 100 maddelik kabul matrisi | Rol × kiracı × plan × medya × POS × KVKK × EİDS | **C** (izolasyon ve medya kısmı) | Mevcut RLS/medya testleri kapsamın bir kısmı; eksik negatif testler P0-3'te | P0-3 |

## 3. Sıralı iş listesi

| # | İş | Öncelik | Kim | Durum |
|---|---|---|---|---|
| P0-1 | KI-42 gerçek boyutla kota | P0 | Claude → sahip (canlı) | **devam ediyor** |
| P0-2 | KI-41 sır sınırı Aşama 2–6 | P0 | sahip + Claude | sahip adımları |
| P0-3 | Kiracı izolasyonu bağımsız denetimi + eksik negatif testler | P0 | Claude (security-reviewer, database-reviewer) | sırada (P0-1'den sonra) |
| P0-4 | Ticari altyapı planları (Vercel Pro, Supabase Pro) | P0 | sahip (D-11) | karar |
| P0-5 | Satıcı kimliği, yasal metinler, KVKK aktarım, saklama | P0 | sahip + avukat; Claude metne işler | karar |
| P0-6 | Paket/fiyat ve abonelik durum makinesi (OPS-02 bayrağı) | P0 | sahip kararı → Claude | karar |
| P0-7 | Ödeme katmanı (sağlayıcıdan bağımsız) + elle tahsilat kaydı | P0 | Claude (architect, database-reviewer) | sırada |
| P0-8 | Yetki belgesi numarası alanı ve gösterimi; EİDS kapsamı | P0 | Claude (alan) + avukat (EİDS) | sırada |
| P0-9 | Ofis açılış runbook'u + uçtan uca prova | P0 | Claude + sahip | sırada |
| P0-10 | R2 kova kilidi + prova takvimi | P0 | sahip + Claude | kısmen |
| P1-1 | Canlı CWV / Sentry deneme olayı (KI-35) | P1 | sahip + Claude | — |
| P1-2 | CSP joker + HSTS yayını (KI-32) | P1 | Claude + sahip | önizleme engelli |
| P1-3 | KI-45 kalanı: atomik fotoğraf sayımı | P1 | Claude | sırada |
| P1-4 | Gerçek telefon + erişilebilirlik kabulü | P1 | Claude (e2e-runner) + sahip cihazı | sırada |
| P1-5 | Talep takibi: yanıtsız talep, ilk yanıt süresi, teslim durumu | P1 | Claude | sırada |
| P1-6 | Destek ve olay süreci, RTO/RPO beyanı (D-18) | P1 | sahip + Claude | karar |
| P1-7 | KI-21 abonelik şeridinin elle teyidi | P1 | sahip | — |
| P1-8 | İstemci hata ucunda dağıtık hız sınırı | P1 | Claude | sırada |
| P1-9 | Tam veri ayrılış paketi (ZIP: CSV + medya) | P1 | Claude (D-05 sonrası) | sırada |
| P2-1 | Alıcı arama profili + izinli yeni ilan alarmı | P2 | Claude | pilot sonrası |
| P2-2 | İlan → talep → randevu kaynak raporu (ofis + portföy sahibi raporu) | P2 | Claude | pilot sonrası |
| P2-3 | Satıcı kazanım (değerleme talebi) sayfası | P2 | Claude | pilot sonrası |

## 4. P0 ayrıntıları

### P0-1 · KI-42 · Depolama kotası bildirilen boyutla atlatılabiliyor  — **devam ediyor**
- **Mevcut durum:** `createMediaUpload` istemcinin bildirdiği `size` ile bekleyen `media_assets` satırı açar; kota bekleyen satırı bu
  boyutla sayar; gerçek boyut yalnız `media_finalize` sonrası yazılır. `media_storage_slot_guard` yolu ve kurumu denetler, **boyutu değil**.
- **Eksik:** 1 B bildirip 50 MB yükleme; ofis başına 50 bekleyen satır × 50 MB ≈ 2,5 GB kota dışı alan (24 saatte temizlenir).
- **Müşteriye etkisi:** Paket depolama limitleri (2/10/50 GB) güvenilmez; maliyet bir ofis tarafından şişirilebilir. Panelimiz her zaman
  gerçek `file.size` bildirdiği için dürüst kullanıcının davranışı değişmez.
- **Dosyalar:** `supabase/pending/20261027000003_media_storage_slots.sql`, yeni `supabase/pending/20261108000001_media_size_guard.sql`,
  `supabase/ops/media_size_guard/`, `tests/security/media-size-guard.test.mjs`.
- **Düzeltme:** Depolama korumasında sahibi dolu (kullanıcı/imzalı adres) orijinal yazımında nesnenin gerçek boyutu
  (`metadata->>'size'`) bekleyen satırın `byte_size` değerini aşarsa `media_size_mismatch` (42501). Boyutu sonradan yazan meta veri
  güncellemesinde de aynı kural. service_role/geri yükleme yolu etkilenmez.
- **Kabul:** 1 B bildirip büyük dosya → reddedilir ve nesne oluşmaz (düzeltmesiz kırmızı); bildirilen = gerçek → kabul; bildirilenden
  küçük → kabul; mevcut güvenlik ve medya E2E testleri yeşil; runbook 01→05→01 yerelde temiz. Canlı uygulama: taze yedek + sahip onayı.

### P0-2 · KI-41 · Canlı sırlar güvenilir sınırda değil
- **Mevcut:** Aşama 0–1 tamam; kural seti zorla gönderim/silmeyi engelliyor. **Eksik:** tam yetkili DB adresi, Supabase S3 ve R2
  anahtarları depo düzeyinde (T1), Claude sahibin kimliğiyle push ediyor (T2), R2 anahtarı yedek silebilir (T3).
- **Etki:** Tüm müşteri verisi tek hatalı iş akışıyla dışarı çıkabilir → KVKK m.12 / 72 saat bildirim riski.
- **Sahip:** Aşama 2 (production dalında PR zorunlu), Aşama 3–4 (sırları ortamlara taşı, anahtarları döndür, depo sırlarını sil, DB
  parolası döndür), 3b (R2 kilidi), 6 (Claude için ayrı GitHub hesabı). **Claude:** 3b sonrası `rclone delete` kaldırma PR'ı; Aşama 5
  salt okunur yedek kullanıcısı runbook'u + yerel prova.
- **Kabul:** production dalından yedek yeşil, çalışma dalından yedek **kırmızı**, ki23 + restore-drill yeşil, art arda iki gece yedeği
  yeşil; `workflow-secrets` testi depo düzeyinde hassas sır kalmadığını sabitler.

### P0-3 · Kiracı izolasyonu bağımsız denetimi
- **Mevcut:** ~200 güvenlik testi; önceki bağımsız incelemeler **medya odaklı**. service_role yolları: `app/actions/admin-users.ts`,
  `platform/tenant/tenant.ts`, `modules/domains/service.ts`, `modules/platform/invitations/member.ts`, `modules/platform/provisioning.ts`,
  `api/cron/media-cleanup`.
- **Eksik:** Tüm sunucu eylemleri ve API uçları için aynı ölçütle tek denetim; R84 kabul matrisinin izolasyon satırları (KI-01…KI-10
  anon/viewer/agent/superadmin/host injection/sahte JWT, CSV dışa aktarma) için negatif testler.
- **Etki:** Bir ofisin müşteri verisinin başka ofise görünmesi ürünü bitirir.
- **Düzeltme:** security-reviewer (eylemler, API, service_role) ve database-reviewer (RLS, SECURITY DEFINER, `user_org_ids`) paralel;
  bulgular KI listesine; eksik negatif testler.
- **Kabul:** her kiracı tablosu için "B kullanıcısı A'nın satırını okuyamaz/yazamaz" testi; her service_role çağrısının yetki ön koşulu
  testle sabit; açık HIGH/CRITICAL yok.

### P0-4 · Ticari altyapı planları (D-11) — sahip
Vercel Hobby ticari kullanıma kapalı (R35 F05, sağlayıcı API kanıtı); Supabase Free'de platform yedeği/PITR yok. **Kabul:** ödeme
alınmadan önce Vercel Pro ve Supabase Pro etkin, harcama alarmı tanımlı, gece yedeği yeşil kalıyor. Claude: geçiş kontrol listesi.

### P0-5 · Satıcı kimliği, yasal metinler, KVKK aktarım, saklama — sahip + avukat
- **Mevcut:** KARAYS yasal seti (aydınlatma, gizlilik, çerez, hizmet şartları, DPA özeti, saklama, başvuru, künye) taslak, şirket
  bilgileri tek yerde `src/modules/karay/legal.ts`; KVKK düzeltmeleri `84c60e9`/`4eb6e17`/`c204cad` production'da değil.
- **Eksik / karar:** gerçek satıcı (şahıs işletmesi/şirket, unvan, VKN, MERSİS, KEP), kod ve marka hakkı, sahibin statüsü (yazılı
  görüş), saklama süreleri (D-05/D-10), yurt dışı aktarım mekanizması (KVKK m.9 standart sözleşme + 5 iş günü bildirim), İYS.
- **Claude (karar gelince):** gerçek bilgileri `legal.ts`'e işler, "taslak" işaretlerini kaldırır, sözleşme sürüm onay kaydı (sürüm +
  zaman + içerik özeti), silme talebinin yedek geri yüklemede yeniden uygulanması (tombstone).
- **Kabul:** `karay-legal` testi gerçek alanların doluluğunu ve taslak işaretinin yokluğunu doğrular; avukat onayı yazılı.

### P0-6 · Paket, fiyat, abonelik durum makinesi
- **Mevcut:** plan limitleri veritabanında; fail-open düzeltmesi canlıda bayrak kapalı; D-04 (7 gün ek süre) ve D-05 (dönem sonu +
  14 gün salt okunur + askı) ana kararları verildi; otomatik geçiş yok.
- **Karar:** fiyatlar, deneme süresi, "salt okunur" kapsamı, ek süre sonrası kısıt (D-01…D-06).
- **Claude (karar sonrası):** aboneliksiz aktif ofis listesi → bayrak açma (KI-31); günlük durum işi (trialing→past_due→read_only→
  suspended, otomatik silme yok); salt okunur kipin veritabanında uygulanması; panelde paket/kullanım ekranı.
- **Kabul:** R84 AB-01…AB-10 testleri (zaman yapay ilerletilerek); UI ve RLS aynı sonucu verir; aboneliksiz ofis sınırsız değil.

### P0-7 · Ödeme katmanı (sağlayıcıdan bağımsız)
- **Mevcut:** yalnız tasarım (`BILLING_ARCHITECTURE.md`, D-09). **Eksik:** `invoices`, `payment_events` (tekil `provider_event_id`),
  `BillingProvider` arayüzü, ham gövdeden imza doğrulayan webhook ucu, konsolda "elle ödeme kaydet" (ilk pilotlar havale/EFT).
- **Etki:** İlk 1–3 pilot elle faturalanabilir; tahsilat kaydı olmadan gecikme/askı elle ve hataya açık.
- **Kabul:** R84 PO-01…PO-04: aynı olay 100 kez → tek geçiş; yanlış imza %100 ret; tutar/para birimi uyuşmazlığı ret; ofis yalnız kendi
  faturalarını okur. Kart verisi saklanmaz. Sağlayıcı (iyzico/PayTR/banka) seçilince yalnız adaptör.

### P0-8 · Yetki belgesi numarası ve EİDS
- **Mevcut:** ofis ayarlarında yetki belgesi alanı yok; "doğrulanmış ilan" iddiası yok (doğru).
- **Claude:** ofis şirket bilgisine yetki belgesi numarası (isteğe bağlı, biçim denetimli), site alt bilgisinde ve ilan detayında
  gösterim, panelde "yetki belgesi girilmedi" uyarısı. **Avukat/sahip:** EİDS'nin ofis sitelerine uygulanıp uygulanmadığı ve KARAYS'ın
  rolü (D-20). Resmî erişim olmadan "doğrulandı" rozeti asla gösterilmez (R84 İL-10).
- **Kabul:** birim (biçim) + E2E (ayarlarda gir → sitede ve ilanda görünür; boşken uyarı).

### P0-9 · Ofis açılışı uçtan uca
- **Mevcut:** konsoldan organizasyon + sahip daveti, özel alan adı modülü (DNS doğrulama, Vercel API).
- **Eksik:** "ofis aç → davet → giriş → ilan → alan adı → DNS → SSL → yayında" tek seferlik kanıtı, adım adım açılış runbook'u,
  tekrar kurulumun kayıt çoğaltmadığı testi.
- **Kabul:** prova ofisi alan adı hariç ≤ 15 dakikada yayına hazır (R35 F20); çift davet/kurulum kayıt çoğaltmaz; ilk gerçek ofiste
  (Elvankent, müşteri onayı sonrası) DNS + 301 + MX etkilenmeden geçiş.

### P0-10 · Yedeklerin silinemezliği
Gece yedeği ✓, izleme ✓ (30 saat), gerçek prova ✓ (02.11), 14 gün alt sınır ✓. **Eksik:** R2 kova kilidi (sahip, Cloudflare);
kilitten sonra iş akışındaki silme adımını kaldıran PR (Claude); Şubat 2027 prova hatırlatması. **Kabul:** yedek anahtarıyla kilitli
nesne silinemiyor (deneme kanıtı).

## 5. Uzman kullanımı

Basit işte ajan açılmaz. P0-1: database-reviewer + security-reviewer (migration ve koruma incelemesi). P0-3: security-reviewer ve
database-reviewer paralel, rapor bağlamı yalnız ilgili matris satırlarıyla. P0-7: architect + database-reviewer. P0-8 ve arayüz:
react-reviewer. P1-4: e2e-runner. Raporların tamamı alt ajanlara verilmez; yalnız ilgili bulgu satırı verilir.
