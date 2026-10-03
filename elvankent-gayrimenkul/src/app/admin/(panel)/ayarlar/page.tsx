import type { Metadata } from 'next';
import Link from '@/components/common/intent-link';
import { Check, Download, FlaskConical, Minus, Trash2 } from 'lucide-react';
import { ActionButton } from '@/components/panel/action-controls';
import { BrandingImageField } from '@/components/panel/branding-image-field';
import { NotificationSettingsForm } from '@/components/admin/settings/notification-settings-form';
import { SiteSettingsForm } from '@/components/admin/settings/site-settings-form';
import { AdminPageHeader, Panel } from '@/components/panel/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { trashDemoListings, removeBrandingImage } from '@/app/actions/admin-settings';
import { formatBytes, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { brandingUrl } from '@/modules/media/variants';
import { isEmailConfigured } from '@/modules/notifications/email';
import { requirePagePermission } from '@/platform/auth/session';

export const metadata: Metadata = { title: 'Ayarlar' };

interface Usage {
  plan_id: string | null;
  subscription_status: string | null;
  limits: { users: number | null; properties: number | null; storage_mb: number | null };
  features: { crm: boolean; analytics: boolean; pdf: boolean; custom_domain: boolean };
  usage: { users: number; properties: number; storage_bytes: number };
}

const SUBSCRIPTION_LABELS: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral' }> = {
  trialing: { label: 'Deneme süresi', tone: 'info' },
  active: { label: 'Aktif', tone: 'success' },
  past_due: { label: 'Ödeme gecikmiş', tone: 'warning' },
  cancelled: { label: 'İptal edildi', tone: 'danger' },
  expired: { label: 'Süresi doldu', tone: 'danger' },
};

const FEATURES: { key: keyof Usage['features']; label: string }[] = [
  { key: 'crm', label: 'CRM (müşteri, randevu, koleksiyon)' },
  { key: 'analytics', label: 'Etkileşim analitiği' },
  { key: 'pdf', label: 'PDF broşür' },
  { key: 'custom_domain', label: 'Özel alan adı' },
];

const EXPORTS = [
  { entity: 'ilanlar', label: 'İlanlar', permission: 'properties.read' },
  { entity: 'musteriler', label: 'Müşteriler', permission: 'leads.read' },
  { entity: 'talepler', label: 'Talepler', permission: 'leads.read' },
] as const;

function UsageRow({ label, used, limit, format = formatNumber }: { label: string; used: number; limit: number | null; format?: (n: number) => string }) {
  const ratio = limit ? used / limit : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
        <span className="font-semibold">{label}</span>
        <span className="numeric text-muted-foreground">
          {format(used)} / {limit ? format(limit) : 'sınırsız'}
        </span>
      </div>
      {limit ? <Progress value={ratio * 100} label={`${label} kullanımı`} tone={ratio >= 0.9 ? 'danger' : 'primary'} className="mt-2" /> : null}
    </div>
  );
}

export default async function SettingsPage() {
  const ctx = await requirePagePermission('settings.manage');
  const [{ data: s }, { data: usageRaw }, { data: sub }, { data: plan }, { count: demoCount }] = await Promise.all([
    ctx.supabase.from('organization_settings').select('hero_title, hero_subtitle, hero_image_url, default_location_precision, service_area').eq('organization_id', ctx.org.id).maybeSingle(),
    ctx.supabase.rpc('org_usage', { p_org: ctx.org.id }),
    ctx.supabase.from('subscriptions').select('status, trial_ends_at, renewal_at, started_at').eq('organization_id', ctx.org.id).in('status', ['trialing', 'active', 'past_due']).maybeSingle(),
    ctx.plan.id ? ctx.supabase.from('plans').select('name').eq('id', ctx.plan.id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from('properties').select('id', { count: 'exact', head: true }).eq('organization_id', ctx.org.id).eq('is_demo', true).is('deleted_at', null),
  ]);
  const [{ data: notify }, { data: company }, { data: deliveries }] = await Promise.all([
    ctx.supabase.from('organization_notification_settings').select('notify_new_lead, emails').eq('organization_id', ctx.org.id).maybeSingle(),
    ctx.supabase.from('organization_settings').select('email').eq('organization_id', ctx.org.id).maybeSingle(),
    ctx.supabase
      .from('notification_deliveries')
      .select('id, event, status, recipients, error, created_at')
      .eq('organization_id', ctx.org.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);
  const usage = usageRaw as unknown as Usage | null;
  const subStatus = SUBSCRIPTION_LABELS[sub?.status ?? usage?.subscription_status ?? ''];
  const canExport = ctx.can('data.export');

  return (
    <>
      <AdminPageHeader title="Ayarlar" description="Ana sayfa, ilan varsayılanları, plan kullanımı ve veri dışa aktarma. Marka ve iletişim bilgileri Şirket Ayarları'ndadır." />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          <Panel title="Ana sayfa" description="Ziyaretçinin ilk gördüğü bölüm.">
            <div className="space-y-6">
              <SiteSettingsForm
                initial={{
                  hero_title: s?.hero_title ?? '',
                  hero_subtitle: s?.hero_subtitle ?? '',
                  default_location_precision: s?.default_location_precision ?? 'approximate',
                }}
                defaults={{
                  title: 'Size uygun gayrimenkulü, güvenle bulun.',
                  subtitle: `${s?.service_area ? `${s.service_area} ` : ''}seçilmiş satılık ve kiralık gayrimenkuller.`,
                }}
              />
              <div className="border-t border-border pt-6">
                <BrandingImageField removeAction={removeBrandingImage}
                  kind="hero"
                  label="Ana sayfa görseli"
                  url={brandingUrl(s?.hero_image_url)}
                  stacked
                  previewClassName="aspect-[16/7] w-full"
                  hint="En az 1280×600 px yatay fotoğraf önerilir; en fazla 2400 px genişliğe küçültülür. Yüklenmezse marka renginde sade bir zemin kullanılır. Yalnızca kullanım hakkına sahip olduğunuz görselleri yükleyin."
                />
              </div>
            </div>
          </Panel>

          <Panel title="Bildirimler" description="Yeni müşteri talebi geldiğinde ofisin haberdar olması için e-posta bildirimi.">
            <NotificationSettingsForm
              initial={{ notify_new_lead: notify?.notify_new_lead ?? true, emails: notify?.emails ?? [] }}
              fallbackEmail={company?.email ?? null}
              emailReady={isEmailConfigured()}
            />
            {deliveries && deliveries.length > 0 && (
              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-[13.5px] font-bold">Son bildirimler</h3>
                <ul className="mt-2 divide-y divide-border text-[13px]">
                  {deliveries.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                      <span className="min-w-0">
                        {d.event === 'test' ? 'Test e-postası' : 'Yeni talep'} · <span className="numeric text-muted-foreground">{formatDateTime(d.created_at)}</span>
                      </span>
                      <Badge variant={d.status === 'sent' ? 'success' : d.status === 'failed' ? 'danger' : 'neutral'}>
                        {d.status === 'sent' ? 'Gönderildi' : d.status === 'failed' ? 'Başarısız' : d.error === 'disabled' ? 'Kapalı' : 'Gönderilmedi'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          {canExport && (
            <Panel title="Veri dışa aktarma" description="Kayıtlarınızı yedeklemek veya başka bir sisteme aktarmak için indirin. Her dışa aktarma güvenlik kayıtlarına yazılır.">
              <ul className="divide-y divide-border">
                {EXPORTS.filter((e) => ctx.can(e.permission)).map((e) => (
                  <li key={e.entity} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="text-[14.5px] font-semibold">{e.label}</span>
                    <span className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/admin/export/${e.entity}?format=csv`} download>
                          <Download /> CSV (Excel)
                        </a>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <a href={`/api/admin/export/${e.entity}?format=json`} download>
                          <Download /> JSON
                        </a>
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
                Dosyalar kişisel veri içerebilir (KVKK). Güvenli bir yerde saklayın ve yalnızca yetkili kişilerle paylaşın. CSV dosyaları Türkçe Excel ile uyumlu olarak noktalı virgülle ayrılır.
              </p>
            </Panel>
          )}

          {(demoCount ?? 0) > 0 && ctx.can('properties.delete') && (
            <Panel title="Demo ilanlar" description="Kurulumla gelen, sitede “DEMO” olarak işaretli örnek ilanlar.">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-2.5 text-[14px]">
                  <FlaskConical className="size-5 text-accent-ink" aria-hidden />
                  <span>
                    <span className="numeric font-bold">{formatNumber(demoCount ?? 0)}</span> demo ilan yayında. Gerçek ilanlarınızı ekledikten sonra kaldırabilirsiniz.
                  </span>
                </p>
                <ActionButton
                  variant="outline"
                  confirm={{
                    title: 'Demo ilanlar çöp kutusuna taşınsın mı?',
                    description: 'Demo ilanlar sitede görünmez olur. Çöp kutusundan geri yükleyebilir veya kalıcı olarak silebilirsiniz.',
                    confirmLabel: 'Taşı',
                  }}
                  action={async () => {
                    'use server';
                    return trashDemoListings();
                  }}
                >
                  <Trash2 /> Demo ilanları kaldır
                </ActionButton>
              </div>
            </Panel>
          )}
        </div>

        <aside className="space-y-6">
          <Panel title="Plan ve kullanım">
            {usage ? (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-bold">{plan?.name ?? usage.plan_id ?? 'Plan yok'}</span>
                  {subStatus && <Badge variant={subStatus.tone}>{subStatus.label}</Badge>}
                </div>
                {sub?.trial_ends_at && sub.status === 'trialing' && <p className="-mt-3 text-[12.5px] text-muted-foreground">Deneme süresi bitişi: {formatDate(sub.trial_ends_at)}</p>}
                {sub?.renewal_at && <p className="-mt-3 text-[12.5px] text-muted-foreground">Yenileme: {formatDate(sub.renewal_at)}</p>}
                <UsageRow label="Kullanıcı" used={usage.usage.users} limit={usage.limits.users} />
                <UsageRow label="İlan" used={usage.usage.properties} limit={usage.limits.properties} />
                <UsageRow label="Depolama" used={usage.usage.storage_bytes} limit={usage.limits.storage_mb ? usage.limits.storage_mb * 1024 * 1024 : null} format={formatBytes} />
                <ul className="space-y-1.5 border-t border-border pt-4 text-[13.5px]">
                  {FEATURES.map((f) => (
                    <li key={f.key} className="flex items-center gap-2">
                      {usage.features[f.key] ? <Check className="size-4 text-success" aria-hidden /> : <Minus className="size-4 text-muted-foreground" aria-hidden />}
                      <span className={usage.features[f.key] ? '' : 'text-muted-foreground'}>{f.label}</span>
                      <span className="sr-only">{usage.features[f.key] ? '— planınızda var' : '— planınızda yok'}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[12.5px] text-muted-foreground">Plan değişikliği için platform yöneticisiyle iletişime geçin.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Plan bilgisi yüklenemedi.</p>
            )}
          </Panel>
          <Panel title="Diğer ayarlar">
            <ul className="space-y-2 text-[14px]">
              <li>
                <Link href="/admin/sirket" className="font-semibold hover:underline">
                  Şirket ayarları
                </Link>
                <span className="text-muted-foreground"> — logo, renkler, iletişim</span>
              </li>
              {ctx.can('seo.manage') && (
                <li>
                  <Link href="/admin/seo" className="font-semibold hover:underline">
                    SEO
                  </Link>
                  <span className="text-muted-foreground"> — arama ve paylaşım görünümü</span>
                </li>
              )}
              {ctx.can('users.manage') && (
                <li>
                  <Link href="/admin/kullanicilar" className="font-semibold hover:underline">
                    Kullanıcılar
                  </Link>
                  <span className="text-muted-foreground"> — ekip ve roller</span>
                </li>
              )}
            </ul>
          </Panel>
        </aside>
      </div>
    </>
  );
}
