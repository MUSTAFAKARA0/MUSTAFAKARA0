'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { cacheTags } from '@/lib/cache-tags';
import { isUuid } from '@/lib/utils';
import { getDomainProvider } from '@/modules/domains';
import { hostnameSchema, orgSchema, type CreateOrgInput } from '@/modules/platform/org-schema';
import { disabledFamilies, isMissingDesignAccessSchema } from '@/modules/platform/design-access';
import { provisionOrganization, type OwnerAccountState } from '@/modules/platform/provisioning';
import { ActionError, assertNoDbError, runAction, type ActionResult } from '@/platform/actions';
import { requireSuperAdmin } from '@/platform/auth/session';
import type { BrandDraft } from '@/site-config/schema';
import { ManifestError, parseManifest } from '@/site-factory/manifest';
import { initialSiteSections, siteInfoSchema, type SiteInfo, type SiteInfoInput } from '@/site-factory/site-info';
import type { Json } from '@/types/supabase';

/**
 * YENİ SİTE OLUŞTUR (KARAY süper admin). Yeni müşteri VERİYLE açılır, kodla değil:
 *
 *   1. createSite     → organizasyon + sahip hesabı ve bekleyen davet (provisionOrganization) → site "taslak" durumuna
 *                       alınır (ziyaretçiye kapalı) → manifestin derlenmiş bölümleri (initialSiteSections:
 *                       önizlemeyle AYNI kaynak), marka/iletişim, site tipi özellikleri, özel alan adı
 *   2. (istemci)      → logo varsa mevcut marka yükleme API'siyle taslağa yüklenir
 *   3. publishNewSite → ilk sürüm yayınlanır; istenirse site hemen yayına alınır
 *
 * Migration gerektirmez: yalnızca mevcut, yetki denetimli veritabanı fonksiyonları kullanılır
 * (platform_create_organization, site_save_draft, site_set_features, site_publish, site_set_status,
 * platform_add_domain — hepsi assert_super_admin). Organizasyon kimliği istemciden alınmaz.
 */
const DESIGN_SECTIONS = ['theme', 'colors', 'typography', 'style', 'home', 'pages', 'seo'] as const;

export interface CreateSiteInput {
  account: CreateOrgInput;
  info: SiteInfoInput;
  manifest: unknown;
  /** Boş = yalnızca alt alan adı ({kısa-ad}.{platform alan adı}) */
  customDomain?: string;
}

function brandDraft(info: SiteInfo): BrandDraft {
  const draft: BrandDraft = {
    display_name: info.siteName,
    legal_name: info.companyName,
    tagline: info.tagline,
    phone: info.phone,
    whatsapp: info.whatsapp,
    email: info.email,
    address_line: info.address.line,
    address_district: info.address.district,
    address_city: info.address.city,
    instagram_url: info.social.instagram,
    facebook_url: info.social.facebook,
    x_url: info.social.x,
    youtube_url: info.social.youtube,
    linkedin_url: info.social.linkedin,
    tiktok_url: info.social.tiktok,
  };
  return Object.fromEntries(Object.entries(draft).filter(([, v]) => typeof v === 'string' && v)) as BrandDraft;
}

export async function createSite(raw: CreateSiteInput): Promise<ActionResult<{ id: string; slug: string; ownerEmail: string; ownerAccount: OwnerAccountState; warnings: string[] }>> {
  return runAction(async () => {
    const session = await requireSuperAdmin();
    // Her şey organizasyon açılmadan ÖNCE doğrulanır (yarım kayıt bırakmamak için)
    const info = siteInfoSchema.safeParse(raw?.info);
    if (!info.success) throw new ActionError(info.error.issues[0]?.message ?? 'Site bilgilerini kontrol edin.');
    try {
      parseManifest(raw?.manifest);
    } catch (e) {
      throw new ActionError(e instanceof ManifestError ? e.message : 'Geçersiz site manifesti.');
    }
    // KARAY'ın global olarak kapattığı aileyle yeni site açılamaz
    if ((await disabledFamilies(session.supabase)).disabled.has((raw.manifest as { designFamily: string }).designFamily)) throw new ActionError('Bu tasarım ailesi katalogda kapalı.');
    const account = orgSchema.parse(raw?.account);
    const host = raw?.customDomain?.trim() ? hostnameSchema.parse(raw.customDomain) : null;
    const { sections, features } = initialSiteSections(raw.manifest, info.data);

    const created = await provisionOrganization(session, account);
    const orgId = created.id;
    const db = session.supabase;
    const warnings: string[] = [];
    try {
      // Yapılandırma tamamlanana kadar site ziyaretçiye kapalıdır
      assertNoDbError((await db.rpc('site_set_status', { p_org: orgId, p_status: 'draft', p_message: undefined })).error);
      for (const section of DESIGN_SECTIONS) {
        const { error } = await db.rpc('site_save_draft', { p_org: orgId, p_section: section, p_value: sections[section] as Json });
        assertNoDbError(error);
      }
      assertNoDbError((await db.rpc('site_save_draft', { p_org: orgId, p_section: 'brand', p_value: brandDraft(info.data) as Json })).error);
      assertNoDbError((await db.rpc('site_set_features', { p_org: orgId, p_overrides: features as Json })).error);
    } catch {
      throw new ActionError(`Hesap oluşturuldu (${account.slug}) ancak site yapılandırması tamamlanamadı. Site taslak durumunda ve ziyaretçiye kapalı; Web Siteleri sayfasından devam edebilirsiniz.`);
    }
    // Seçilen aile ofise izinli olarak kaydedilir (ofis panelinde tasarımını görebilsin);
    // yetki tabloları yoksa (migration uygulanmamış) yalnızca uyarı
    const family = (raw.manifest as { designFamily: string }).designFamily;
    const grant = await db.rpc('platform_set_org_design_families', { p_org: orgId, p_families: [family] });
    if (grant.error && !isMissingDesignAccessSchema(grant.error)) warnings.push('Tasarım ailesi izni kaydedilemedi; Tema sekmesinden ekleyebilirsiniz.');
    if (host) {
      const { error } = await db.rpc('platform_add_domain', { p_org: orgId, p_hostname: host, p_primary: true });
      if (error?.code === '23505') warnings.push(`${host} başka bir organizasyona bağlı; alan adı eklenmedi.`);
      else if (error) warnings.push('Özel alan adı eklenemedi; Alan adı sekmesinden tekrar deneyin.');
      else {
        const hosted = await getDomainProvider().add(host);
        if (!hosted.ok) warnings.push(`Alan adı kaydedildi ancak barındırmaya eklenemedi: ${hosted.error}`);
      }
    }
    updateTag(cacheTags.tenants);
    revalidatePath('/platform', 'layout');
    return { id: orgId, slug: account.slug, ownerEmail: created.ownerEmail, ownerAccount: created.ownerAccount, warnings };
  });
}

/** İlk sürümü yayınlar (logo yüklemesinden sonra); activate: site hemen ziyaretçiye açılır */
export async function publishNewSite(orgId: string, activate: boolean): Promise<ActionResult<{ version: number }>> {
  return runAction(async () => {
    if (!isUuid(orgId)) throw new ActionError('Geçersiz site.');
    const session = await requireSuperAdmin();
    const { data, error } = await session.supabase.rpc('site_publish', { p_org: orgId, p_note: 'İlk yayın (Yeni Site Oluştur)' });
    assertNoDbError(error);
    if (activate === true) assertNoDbError((await session.supabase.rpc('site_set_status', { p_org: orgId, p_status: 'active', p_message: undefined })).error);
    updateTag(cacheTags.tenants);
    updateTag(cacheTags.org(orgId));
    revalidatePath('/platform', 'layout');
    return { version: data as number };
  }, 'Site oluşturuldu.');
}
