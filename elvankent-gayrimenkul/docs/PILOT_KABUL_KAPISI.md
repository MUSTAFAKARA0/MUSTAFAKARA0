# PILOT READY · kabul kapısı (ilk ücretsiz pilot ofis)

> 08.11.2026 · dal `claude/karays-refocus-t84k81`. Amaç: pilot ofis bağlanırken teknik geliştirmeye dönülmemesi.
> Kural: bir satır ✓ değilse pilot ofis **gerçek kişisel veri ve ilanla** açılmaz. Gerçek ofis oluşturma, alan adı değişikliği, canlı
> migration, birleştirme ve yayın her biri ayrı sahip onayıyla.

## A. Teknik (Claude) — kod ve kanıt

| # | Kapı | Durum | Kanıt |
|---|---|---|---|
| A1 | Yeni ofis uçtan uca: konsoldan aç → sahip daveti → aktivasyon → alan adı → yayın → ilan + 2 fotoğraf → ziyaretçi bilgi + randevu talebi doğru ofise → danışman ekle, sınırlı yetki → telefonda taşma yok | kod; CI bekliyor | `tests/e2e/pilot-journey.spec.ts` PJ-1…PJ-7 |
| A2 | Kiracı izolasyonu (uygulama + veritabanı) bağımsız denetim; kritik/yüksek yok | ✓ kod (F canlıda değil) | KALAN_ISLER KI-46; CI #214/#218 |
| A3 | Depolama kotası atlatılamaz | ✓ kod (E canlıda değil) | KI-42; CI #214 |
| A4 | Yetki belgesi no alanı ve sitede gösterim | ✓ kod (G canlıda değil) | KI-47; CI #218 |
| A5 | Pilot süresi: deneme bitişi konsoldan (1–365 gün), ödeme yok | kod; CI bekliyor | H, `tests/security/pilot-trial-end.test.mjs` PT-01…05 |
| A6 | Yedek + gerçek geri yükleme provası | ✓ | KI-22/KI-24 (02.11), gece yedekleri |
| A7 | Hata izleme | kısmen | Sentry bağlı; deneme olayı sahip onayıyla (KI-35) |

## B. Canlı değişiklikler (sahip onayı) — pilottan önce

| # | İş | Belge |
|---|---|---|
| B1 | Bu daldaki kodun production'a yayını (PR + birleştirme) | — (onayla PR açılır) |
| B2 | F (KI-46 üyelik koruması) | `docs/GO_NOGO_KI42_KI46.md` |
| B3 | E (KI-42 boyut koruması) | `docs/GO_NOGO_KI42_KI46.md` |
| B4 | G (yetki belgesi no) | `supabase/ops/license_no/README.md` |
| B5 | H (pilot süresi) | `supabase/ops/pilot_trial_end/README.md` |
| B6 | KI-41 Aşama 2–4 (sırlar ortamlarda, anahtar döndürme, depo sırları silinir) | `docs/KI41_GUVENLIK_PLANI.md` |
| B7 | Vercel Pro / Supabase Pro (ticari kullanım; ücretsiz pilotta da üçüncü kişi verisi işlenir) | D-11 |

## C. Hukuki / işletme kararları (Claude tamamlamış saymaz)

| # | Karar | Neden pilottan önce |
|---|---|---|
| C1 | Hizmeti veren taraf (şahıs/şirket, unvan, VKN, adres, KEP) — D-19 | Yasal metinlerde ve pilot sözleşmesinde taraf |
| C2 | Pilot sözleşmesi / DPA (ofis veri sorumlusu, KARAYS veri işleyen) ve alt işleyen + yurt dışı aktarım (KVKK m.9) — D-10 | Ofisin gerçek müşteri verisi (talep, randevu, CRM) işlenecek |
| C3 | KARAYS ve ofis sitesi aydınlatma/çerez metinlerinin avukat onayı (kodda taslak, `84c60e9`/`4eb6e17` production'da değil) | Ziyaretçi formu kişisel veri toplar |
| C4 | EİDS ve ilan mevzuatı: yetki belgesinin hangi kanalda gösterileceği, ilan doğrulama yükümlülüğü — D-20 | Gerçek ilan yayını |
| C5 | Pilot süresi ve sonunda ne olacağı (veri, site, alan adı) — D-05 kısmı | Ofise yazılı söz |
| C6 | Destek kanalı ve olay sorumlusu (D-18) | Pilot sırasında sorun bildirimi |

**Pilot günü (A, B, C tamam olduktan sonra) yalnız şu yapılır:** konsol › Yeni müşteri (ofis bilgileri) → plan "Deneme" → pilot bitişi →
sahip daveti → ofis alan adı DNS'i (ofisin onayıyla) → yayın → pilot kabul testi (A1 adımları gerçek kullanıcıyla, telefonda).
