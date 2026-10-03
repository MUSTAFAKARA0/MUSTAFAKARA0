'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Copy, Save, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/form-controls';
import { saveCollection } from '@/app/actions/admin-crm';
import { cn } from '@/lib/utils';

interface Option {
  id: string;
  label: string;
  status?: string;
}

interface Initial {
  id: string;
  title: string;
  message: string | null;
  customer_id: string | null;
  items: { property_id: string; note: string | null }[];
}

export function CollectionForm({ initial, customers, properties, siteBase }: { initial?: Initial; customers: Option[]; properties: Option[]; siteBase: string }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [message, setMessage] = useState(initial?.message ?? '');
  const [customerId, setCustomerId] = useState(initial?.customer_id ?? '');
  const [expires, setExpires] = useState<string>(initial ? 'keep' : '30');
  const [items, setItems] = useState<{ property_id: string; note: string }[]>(initial?.items.map((i) => ({ property_id: i.property_id, note: i.note ?? '' })) ?? []);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const byId = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const selected = new Set(items.map((i) => i.property_id));
  const results = properties.filter((p) => !selected.has(p.id) && p.label.toLocaleLowerCase('tr-TR').includes(q.toLocaleLowerCase('tr-TR'))).slice(0, 12);

  function move(index: number, delta: number) {
    setItems((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await saveCollection(initial?.id ?? null, {
      title,
      message: message || null,
      customer_id: customerId || null,
      expires_in_days: expires === 'keep' || expires === 'none' ? null : Number(expires),
      keep_expiry: expires === 'keep',
      items: items.map((i) => ({ property_id: i.property_id, note: i.note || null })),
    });
    setPending(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success('Seçki kaydedildi.');
    if (!initial) {
      setLink(`${siteBase}/koleksiyon/${res.data.token}`);
      router.replace(`/admin/koleksiyonlar/${res.data.id}`);
    } else router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="text-[15.5px] font-bold">Seçilen ilanlar ({items.length})</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Müşterinin göreceği sırayla dizin; her ilana kısa bir not ekleyebilirsiniz.</p>
          {items.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">Sağdaki listeden ilan ekleyin.</p>
          ) : (
            <ol className="mt-5 space-y-3">
              {items.map((item, i) => (
                <li key={item.property_id} className="rounded-xl border border-border p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="numeric mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[12px] font-bold">{i + 1}</span>
                    <p className="min-w-0 flex-1 text-[14px] font-semibold">{byId.get(item.property_id)?.label ?? 'İlan'}</p>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon-xs" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Yukarı taşı">
                        <ArrowUp />
                      </Button>
                      <Button size="icon-xs" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Aşağı taşı">
                        <ArrowDown />
                      </Button>
                      <Button size="icon-xs" variant="ghost" onClick={() => setItems((l) => l.filter((x) => x.property_id !== item.property_id))} aria-label="Seçkiden çıkar">
                        <X />
                      </Button>
                    </div>
                  </div>
                  <label className="sr-only" htmlFor={`note-${item.property_id}`}>
                    Not
                  </label>
                  <Input
                    id={`note-${item.property_id}`}
                    className="mt-2.5 h-10"
                    value={item.note}
                    maxLength={500}
                    placeholder="Danışman notu (ör. “Okula yakın, bütçenize uygun”)"
                    onChange={(e) => setItems((l) => l.map((x) => (x.property_id === item.property_id ? { ...x, note: e.target.value } : x)))}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <Field label="Başlık" htmlFor="col-title" required hint="Müşterinin göreceği başlık">
            <Input id="col-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="ör. Ayşe Hanım için 3+1 seçkisi" />
          </Field>
          <Field label="Mesaj" htmlFor="col-message" optional>
            <Textarea id="col-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} />
          </Field>
          <Field label="Müşteri" htmlFor="col-customer" optional>
            <Select id="col-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Seçilmedi</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Bağlantı geçerliliği" htmlFor="col-expires">
            <Select id="col-expires" value={expires} onChange={(e) => setExpires(e.target.value)}>
              {initial && <option value="keep">Mevcut süreyi koru</option>}
              <option value="7">7 gün</option>
              <option value="14">14 gün</option>
              <option value="30">30 gün</option>
              <option value="90">90 gün</option>
              <option value="none">Süresiz</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full" loading={pending} disabled={items.length === 0 || title.trim().length < 3}>
            {!pending && <Save />} {initial ? 'Kaydet' : 'Seçkiyi oluştur'}
          </Button>
          {link && (
            <div className="rounded-xl bg-success-soft p-3 text-[13px] text-success">
              <p className="font-semibold">Paylaşım bağlantısı hazır</p>
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1.5 font-semibold underline underline-offset-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  toast.success('Bağlantı kopyalandı.');
                }}
              >
                <Copy className="size-3.5" aria-hidden /> Kopyala
              </button>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="text-[15.5px] font-bold">İlan ekle</h2>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <label htmlFor="col-search" className="sr-only">
              İlan ara
            </label>
            <Input id="col-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="İlan no veya başlık" className="pl-10" />
          </div>
          <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={items.length >= 30}
                  onClick={() => setItems((l) => [...l, { property_id: p.id, note: '' }])}
                  className={cn('w-full rounded-lg px-3 py-2 text-left text-[13.5px] transition hover:bg-surface-muted', p.status !== 'published' && 'text-muted-foreground')}
                >
                  {p.label}
                  {p.status !== 'published' && <span className="ml-1 text-[12px]">({p.status === 'sold' ? 'satıldı' : p.status === 'rented' ? 'kiralandı' : p.status})</span>}
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="px-3 py-2 text-[13px] text-muted-foreground">Eşleşen ilan yok.</li>}
          </ul>
        </section>
      </div>
    </form>
  );
}
