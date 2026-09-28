import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CalendarClock, Link2Off, Phone, Sparkles } from 'lucide-react';
import { WhatsAppIcon } from '@/components/common/brand-icons';
import { EmptyState } from '@/components/common/empty-state';
import { PropertyCard } from '@/components/property/property-card';
import { Button } from '@/components/ui/button';
import { telHref, whatsappHref } from '@/lib/contact-links';
import { formatDate } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/env';
import { createAnonClient } from '@/lib/supabase/server';
import { getPropertiesByIds } from '@/modules/properties/queries';
import { requireTenant } from '@/platform/tenant/tenant';

// Her ziyaret sayılır ve süre/iptal durumu anında uygulanır → önbellek yok
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Size özel ilan seçkisi',
  robots: { index: false, follow: false, nocache: true },
  // Bağlantıdaki erişim anahtarı dış sitelere Referer ile sızmasın
  referrer: 'no-referrer',
};

type CollectionResult =
  | { status: 'not_found' }
  | { status: 'revoked' | 'expired'; organization_id: string }
  | {
      status: 'ok';
      organization_id: string;
      title: string;
      message: string | null;
      created_at: string;
      expires_at: string | null;
      items: { property_id: string; note: string | null }[];
    };

async function loadCollection(token: string): Promise<CollectionResult> {
  if (!isSupabaseConfigured() || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return { status: 'not_found' };
  const { data, error } = await createAnonClient().rpc('get_public_collection', { p_token: token });
  if (error) throw new Error(`Seçki yüklenemedi: ${error.message}`);
  return (data ?? { status: 'not_found' }) as CollectionResult;
}

export default async function CollectionPage({ params }: PageProps<'/t/[tenant]/koleksiyon/[token]'>) {
  const { tenant: key, token } = await params;
  const tenant = await requireTenant(key);
  const collection = await loadCollection(token);
  // Başka bir ofisin seçkisi bu alan adında açılamaz
  if (collection.status === 'not_found' || collection.organization_id !== tenant.id) notFound();

  const s = tenant.settings;
  const tel = telHref(s.phone);

  if (collection.status !== 'ok') {
    return (
      <div className="container-page py-16 sm:py-24">
        <EmptyState
          icon={collection.status === 'expired' ? CalendarClock : Link2Off}
          title={collection.status === 'expired' ? 'Bu seçkinin süresi doldu' : 'Bu seçki artık paylaşılmıyor'}
          description="Güncel seçenekler için danışmanınızla iletişime geçebilir veya tüm ilanlara göz atabilirsiniz."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/ilanlar">İlanlara git</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/iletisim">İletişime geçin</Link>
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const properties = await getPropertiesByIds(
    tenant.id,
    collection.items.map((i) => i.property_id),
  );
  const notes = new Map(collection.items.map((i) => [i.property_id, i.note]));
  const whatsapp = tenant.site.overrides.whatsapp === false ? null : whatsappHref(s.whatsapp ?? s.phone, `Merhaba, "${collection.title}" seçkisindeki ilanlar hakkında bilgi almak istiyorum.`);

  return (
    <>
      <div className="border-b border-border bg-surface">
        <div className="container-page pt-10 pb-12 sm:pt-14 sm:pb-16">
          <p className="eyebrow flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden /> Size özel seçki
          </p>
          <h1 className="mt-3 max-w-4xl font-display text-display-xl text-foreground">{collection.title}</h1>
          {collection.message && (
            <div className="mt-5 max-w-2xl space-y-3 text-[16.5px] leading-relaxed text-muted-foreground">
              {collection.message
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
            </div>
          )}
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span>
              {s.display_name} · {formatDate(collection.created_at)}
            </span>
            {collection.expires_at && <span>Bu bağlantı {formatDate(collection.expires_at)} tarihine kadar geçerlidir.</span>}
          </p>
          {(whatsapp || tel) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {whatsapp && (
                <Button asChild variant="whatsapp" size="lg">
                  <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="size-5" /> WhatsApp&apos;tan yazın
                  </a>
                </Button>
              )}
              {tel && (
                <Button asChild variant="outline" size="lg">
                  <a href={tel}>
                    <Phone /> Arayın
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container-page py-12 sm:py-16">
        {properties.length === 0 ? (
          <EmptyState
            icon={Link2Off}
            title="Bu seçkideki ilanlar artık yayında değil"
            description="Güncel seçenekler için danışmanınızla iletişime geçebilirsiniz."
            action={
              <Button asChild>
                <Link href="/ilanlar">İlanlara git</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
            {properties.map((p, i) => {
              const note = notes.get(p.id);
              return (
                <li key={p.id} className="flex flex-col">
                  <PropertyCard property={p} priority={i < 3} />
                  {note && (
                    <p className="mt-4 rounded-xl bg-accent-soft px-4 py-3 text-[14px] leading-relaxed text-foreground">
                      <strong className="block text-[12px] font-bold tracking-wide text-accent-ink uppercase">Danışman notu</strong>
                      {note}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-14 text-[13px] text-muted-foreground">
          Bu sayfa yalnızca bağlantıya sahip kişilerle paylaşılmıştır ve arama motorlarında listelenmez.
        </p>
      </div>
    </>
  );
}
