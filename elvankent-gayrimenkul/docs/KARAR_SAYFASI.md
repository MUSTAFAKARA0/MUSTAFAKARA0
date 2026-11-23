# KARAYS · Karar sayfası (evet / hayır)

> 24.11.2026 · Her satırda önerim var; **"evet"** demeniz önerinin kabulü demek. Ayrıntı ve kaynaklar:
> [KARAR_ARASTIRMA_PAKETI.md](KARAR_ARASTIRMA_PAKETI.md) · kayıt: [PHASE2_DECISION_REGISTER.md](PHASE2_DECISION_REGISTER.md).
> 23.11 kararı gereği ücret, fatura, şirket ve ticari sözleşme içeren kararlar **terhis sonrasına** ayrıldı (B bölümü).

## A · Şimdi verilebilecek kararlar (ücretsiz, ticari işlem değil)

| # | Karar | Önerim | Neden | Cevap |
|---|---|---|---|---|
| A1 | **D-14** Dal ve yayın düzeni | Bugünkü düzen kalıcı kural olsun: canlıya yalnız PR ile, CI yeşilken, sahibin birleştirmesiyle | Zaten böyle çalışıyor (`uretim-pr` kuralı, 14.11); kayda geçirmek yeter | ☐ evet ☐ hayır |
| A2 | **D-16** Güvenlik güncellemeleri | Yalnız güvenlik yaması içeren güncellemeler, CI yeşil ve sahip onayıyla; kayıt "uygulandı" diye kapanır | O-4 yaması 01.11'de yayında; kural yazılı değil | ☐ evet ☐ hayır |
| A3 | **D-15 (1)** CSP'deki `*.supabase.co` jokerini kaldırmak | **Evet, ama pilot öncesi canlı duman testiyle**: kod değişikliği küçük; geri alınabilir. Sizden bir PR birleştirmesi ve 5 dk duman testi (giriş, fotoğraf yükleme, ilan sayfası) ister | Joker, başka Supabase projelerine bağlantıya izin veriyor; kendi adresimiz zaten açıkça listeli. Oturumum canlı siteye erişemediği için son doğrulama sizde | ☐ evet ☐ hayır |
| A4 | **D-15 (2)** Müşteri alan adlarında HSTS | **Karar gerekmiyor — yapılmış.** Ofis alan adlarına `includeSubDomains; preload` gönderilmiyor (`hstsForHost`, `src/proxy.ts`) | — | bilgi |
| A5 | **D-15 (3)** Nonce'lu CSP (`unsafe-inline` kaldırma) | **Hayır, şimdilik.** İlk ücretli müşterilerden sonra, önce "yalnız rapor" modunda | Next.js'te sayfa önbelleğini bozar; kırılma riski fayda dengesinden büyük | ☐ evet ☐ hayır |
| A6 | **D-03** Pilot süresi | Pilot ofise **60 gün**; konsoldan ayarlanır (H canlıda). Kart/ödeme yok; bitişte telefonla görüşme, otomatik kısıtlama yok | H ile artık kodda sabit 14 gün sorunu yok | ☐ evet ☐ hayır |
| A7 | **D-18** Destek sözü (pilot) | "En iyi çaba": hafta içi 09–18, site tamamen kapalıysa 4 iş saati içinde ilk yanıt; veri ihlalinde ofise en geç 24 saat | Sözleşme taslağıyla aynı (m.7.8); sayısal tazminat yok | ☐ evet ☐ hayır |
| A8 | **D-17** Elle işletim eşiği | 5 ücretli müşteriye kadar her şey elle; sonra otomasyon | Erken otomasyon gereksiz kod ve ücret | ☐ evet ☐ hayır |
| A9 | **D-12** Depo görünürlüğü | **Şimdilik açık kalsın**; terhis sonrası şirket kurulunca özel (private) depoya taşınsın | Özel depoda GitHub'ın ücretsiz planı CI için aylık 2.000 dakika verir; bizim CI her gönderide üç iş çalıştırır (her biri 10–30 dk), ayda birkaç düzine gönderide sınır aşılır → **ücret çıkar**. Açık depoda CI ücretsiz. Sırlar depoda değil (gitleaks her gönderide tarıyor) | ☐ evet ☐ hayır |
| A10 | **D-01 / D-02** Plan ve fiyat (kâğıt üstünde) | 3 plan kalsın; fiyat teklif usulü, KDV hariç, yıllık peşin seçeneği. **Rakam terhis sonrası** | Şimdi yalnız yapı kararı; satış yok | ☐ evet ☐ hayır |

## B · Terhis sonrası (şirket ve mali müşavirle)

| # | Karar | Önerim | Bağlı |
|---|---|---|---|
| B1 | **D-19** Satıcı kim (şahıs / şirket) | Mali müşavir görüşüyle | [TERHIS_SONRASI_EVRAK_PAKETI.md](legal/TERHIS_SONRASI_EVRAK_PAKETI.md) §1 |
| B2 | **D-11** Altyapı planları | Vercel Pro (~20 $/ay, harcama sınırı 20 $). Supabase Pro yalnız gerekirse (gece yedeği R2'de, her gün yeşil) | B1 |
| B3 | **D-10** KVKK yurt dışı aktarım | Sağlayıcılara standart sözleşme talebi + 5 iş günü bildirim | Evrak paketi §2–3 |
| B4 | **D-07 / D-08** Fatura ve tahsilat | Havale/EFT + müşavirin söylediği e-belge yolu; iyzico/PayTR 5 müşteriden sonra | B1 |
| B5 | **D-04 / D-05** alt kararları (gecikme, iptal, saklama) | Araştırma paketindeki öneriler (8. gün bakım modu, askıdan 90 gün sonra silme) sözleşmeye yazılır | B1 |
| B6 | **D-20** EİDS | Ofisin kendi sitesindeki ilanlar için EİDS gerekliliği Ticaret Bakanlığı/il müdürlüğüne yazılı sorulur; o güne kadar sosyal paylaşım düğmesi kapalı (yapıldı) | B1 |
| B7 | **D-13** alt kararı | Ofis siteleri ofisin kendi alan adıyla (karar verildi 02.11); KARAYS e-postası ayrı alt alan adından | — |

## Cevap nasıl verilir

Bu sayfayı açıp A1…A10 için "evet / hayır" yazmanız yeterli (ör. "A1 evet, A3 evet, A9 hayır"). Ben karar kaydına işler, gereken kodu
yazar ve PR açarım; canlıya alma yine sizin birleştirmenizle olur.
