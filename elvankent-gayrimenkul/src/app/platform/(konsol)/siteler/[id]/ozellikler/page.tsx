import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isUuid } from '@/lib/utils';
import { FeaturesForm, type FeatureRow } from '@/components/platform/site/features-form';
import { getSiteAdmin } from '@/modules/platform/sites';
import { requireSuperAdminPage } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Özellikler · Web Sitesi' };

export default async function Page({ params }: PageProps<'/platform/siteler/[id]/ozellikler'>) {
  const session = await requireSuperAdminPage();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Site kaydı ve plan varsayılanları (geçersiz kılma olmadan) paralel okunur
  const [siteAdmin, { data: sub }] = await Promise.all([
    getSiteAdmin(session, id),
    session.supabase
      .from('subscriptions')
      .select('plan:plans(name, crm_enabled, analytics_enabled, pdf_enabled, custom_domain_enabled)')
      .eq('organization_id', id)
      .in('status', ['trialing', 'active', 'past_due'])
      .limit(1)
      .maybeSingle(),
  ]);
  if (!siteAdmin) notFound();
  const site = siteAdmin;
  const plan = sub?.plan ?? null;
  const planLabel = plan ? `Plan: ${plan.name}` : 'Plan yok';
  const rows: FeatureRow[] = [
    { key: 'crm', label: 'CRM', description: 'Müşteri, talep ve randevu yönetimi (ofis paneli).', base: plan?.crm_enabled ?? false, baseLabel: planLabel },
    { key: 'analytics', label: 'Analitik', description: 'Ofis panelinde ziyaret ve talep raporları.', base: plan?.analytics_enabled ?? false, baseLabel: planLabel },
    { key: 'pdf', label: 'PDF ilan broşürü', description: 'İlanlar için yazdırılabilir PDF.', base: plan?.pdf_enabled ?? false, baseLabel: planLabel },
    { key: 'custom_domain', label: 'Özel alan adı', description: 'Kiracının kendi alan adını kullanması.', base: plan?.custom_domain_enabled ?? false, baseLabel: planLabel },
    { key: 'blog', label: 'Blog / Rehber', description: 'Sitede Rehber sayfaları ve menü bağlantısı.', base: true, baseLabel: 'Varsayılan' },
    { key: 'valuation', label: 'Değerleme talebi', description: 'Değerleme talep formu ve ilgili bağlantılar (otomatik değerleme yoktur).', base: true, baseLabel: 'Varsayılan' },
    { key: 'whatsapp', label: 'WhatsApp', description: 'WhatsApp düğmeleri ve yüzen iletişim düğmesi.', base: true, baseLabel: 'Varsayılan' },
    { key: 'favorites', label: 'Favoriler ve karşılaştırma', description: 'Ziyaretçinin ilanları kaydetmesi ve karşılaştırması.', base: true, baseLabel: 'Varsayılan' },
    { key: 'advanced_seo', label: 'Gelişmiş SEO', description: 'Yapılandırılmış veri (RealEstateAgent) ayarlarının uygulanması.', base: true, baseLabel: 'Varsayılan' },
    { key: 'dark_mode', label: 'Koyu görünüm', description: 'Renkler sekmesinde koyu renk ön ayarlarının kullanılabilmesi.', base: false, baseLabel: 'Varsayılan' },
  ];
  return <FeaturesForm orgId={site.org.id} rows={rows} initial={site.overrides} />;
}
