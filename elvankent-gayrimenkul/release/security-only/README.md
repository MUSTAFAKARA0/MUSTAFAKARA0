# Yalnız güvenlik yaması (A seçeneği) · production `ff2f7da` için

Bu klasör, production koduna yalnızca güvenlik düzeltmelerini ekleyen yayın adayını taşır. Aday ayrı bir dal olarak itilmedi: production tabanlı yeni bir dalda Vercel koruma dosyası olmadığı için push bir Preview dağıtımı açardı. Patch bu doğrulama dalında (Vercel dağıtımı kapalı) saklanır ve CI'da sınanır.

| Alan | Değer |
| --- | --- |
| Taban | `ff2f7da5444b39b837cf36af7d04526ba44e92e7` (production dalı) |
| Patch | `security-only-ff2f7da.patch` (`git format-patch`, kaynak commit `57fdbb7`) |
| SHA-256 | `security-only-ff2f7da.patch.sha256` |
| Beklenen ağaç | `29f81af937b1f211c04b1d25db6e396c8b59a146` (`git write-tree`, tabana uygulandıktan sonra) |
| İçerik | next 16.4.3, sharp ^0.35.5 (0.35.5), zod ^4.6.6 (4.6.7), source-map-js 1.2.2; `src/modules/media/processing.ts` uyumluluk düzeltmesi; `tests/unit/security-patch.test.mjs` (SP-01…SP-06) |
| Migration | Yok. Yeni kod production veritabanı şemasıyla değişmeden çalışır ([K17 §5](../../docs/K17_KARAYS_RELEASE.md)) |

## CI

`.github/workflows/elvankent-security-candidate.yml` bu klasör değişince yalnızca doğrulama dalında çalışır. İki kolu vardır:
- `baseline`: değiştirilmemiş `ff2f7da`.
- `candidate`: `ff2f7da` + patch.

Her iki kolda typecheck, ESLint, birim testleri, build, yerel Supabase'de RLS/MFA/kiracı izolasyonu ve Playwright E2E çalışır. `npm audit` yalnızca adayda koşar; tabanın bu adımda kaldığı biliniyor (CI #78). Adayın baseline'dan ek bir başarısızlığı olmamalıdır.

## Yayın dalını yeniden üretmek (onaydan sonra)

Depo kökünden, bu klasörün bulunduğu dal açıkken (dal değişince klasör kaybolduğu için patch önce kopyalanır):

```bash
(cd elvankent-gayrimenkul/release/security-only && sha256sum -c security-only-ff2f7da.patch.sha256)
cp elvankent-gayrimenkul/release/security-only/security-only-ff2f7da.patch /tmp/security-only.patch
git switch -c claude/karays-guvenlik-yamasi ff2f7da
git am < /tmp/security-only.patch
test "$(git rev-parse HEAD^{tree})" = 29f81af937b1f211c04b1d25db6e396c8b59a146
```

Bu dalın push'u, production'a merge'ü ve dağıtımı O-4 onayı gerektirir.
