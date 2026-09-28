"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  Input,
  Select,
  Switch,
  Textarea,
} from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import {
  LivePreview,
  type Brand,
} from "@/components/platform/site/appearance-forms";
import {
  SaveBar,
  useSectionSave,
} from "@/components/platform/site/site-actions";
import {
  DEFAULT_HOME_SECTIONS,
  PAGE_KEYS,
  type FooterConfig,
  type HeaderConfig,
  type HomeSectionConfig,
  type HomeSectionType,
  type NavItemConfig,
  type PageKey,
  type PageSettings,
  type SeoConfig,
  type SiteConfig,
} from "@/platform/site/schema";

const newId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

function move<T>(list: T[], index: number, delta: number): T[] {
  const next = [...list];
  const target = index + delta;
  if (target < 0 || target >= next.length) return list;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function RowControls({
  index,
  count,
  onMove,
  onRemove,
  visible,
  onToggle,
  label,
}: {
  index: number;
  count: number;
  onMove: (d: number) => void;
  onRemove?: () => void;
  visible?: boolean;
  onToggle?: () => void;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {onToggle && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={onToggle}
          aria-label={visible ? `${label}: gizle` : `${label}: göster`}
          title={visible ? "Gizle" : "Göster"}
        >
          {visible ? <Eye /> : <EyeOff />}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={index === 0}
        onClick={() => onMove(-1)}
        aria-label={`${label}: yukarı taşı`}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
        aria-label={`${label}: aşağı taşı`}
      >
        <ArrowDown />
      </Button>
      {onRemove && (
        <Button
          type="button"
          variant="danger-ghost"
          size="icon-xs"
          onClick={onRemove}
          aria-label={`${label}: sil`}
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------- Header
export function HeaderForm({
  orgId,
  initial,
  preview,
}: {
  orgId: string;
  initial: HeaderConfig;
  preview: {
    draft: SiteConfig;
    brand: Brand;
    darkAllowed: boolean;
    name: string;
  };
}) {
  const [h, setH] = useState<HeaderConfig>(initial);
  const [ctaOn, setCtaOn] = useState(Boolean(initial.cta));
  const [cta, setCta] = useState(
    initial.cta ?? { label: "Değerleme talebi", href: "/degerleme" },
  );
  const { save, pending } = useSectionSave(orgId, "header");
  const value = { ...h, cta: ctaOn ? cta : undefined };
  const dirty =
    JSON.stringify(value) !== JSON.stringify({ ...initial, cta: initial.cta });
  const set = <K extends keyof HeaderConfig>(k: K, v: HeaderConfig[K]) =>
    setH((x) => ({ ...x, [k]: v }));
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="min-w-0 space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-bold">Marka alanı</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Logo, en-boy oranı bozulmadan ve kırpılmadan sığdırılır. Logonuzda
            şirket adı yazmıyorsa &quot;Logo + şirket adı&quot;nı seçin.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Gösterim" htmlFor="h-brand">
              <Select
                id="h-brand"
                value={h.brand}
                onChange={(e) =>
                  set("brand", e.target.value as HeaderConfig["brand"])
                }
              >
                <option value="auto">
                  Otomatik (logo varsa logo, yoksa ad)
                </option>
                <option value="logo">Yalnızca logo</option>
                <option value="logo-name">Logo + şirket adı</option>
                <option value="name">Yalnızca şirket adı</option>
              </Select>
            </Field>
            <div className="sm:pt-7">
              <Switch
                checked={h.showTagline}
                onCheckedChange={(v) => set("showTagline", v)}
                label="Adın altında slogan"
                description="Yalnızca geniş ekranda; slogan Marka sekmesinden."
              />
            </div>
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-bold">Masaüstü</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Görünüm" htmlFor="h-style">
              <Select
                id="h-style"
                value={h.style}
                onChange={(e) =>
                  set("style", e.target.value as HeaderConfig["style"])
                }
              >
                <option value="light">Açık zemin</option>
                <option value="dark">Koyu zemin (ikincil renk)</option>
              </Select>
            </Field>
            <Field label="Yükseklik" htmlFor="h-height">
              <Select
                id="h-height"
                value={h.height}
                onChange={(e) =>
                  set("height", e.target.value as HeaderConfig["height"])
                }
              >
                <option value="regular">Normal</option>
                <option value="compact">Kompakt</option>
              </Select>
            </Field>
          </div>
          <div className="mt-5 space-y-4">
            <Switch
              checked={h.sticky}
              onCheckedChange={(v) => set("sticky", v)}
              label="Yapışkan header"
              description="Sayfa kaydırılırken üstte sabit kalır."
            />
            <Switch
              checked={h.showPhone}
              onCheckedChange={(v) => set("showPhone", v)}
              label="Telefon düğmesi"
            />
            <Switch
              checked={h.showWhatsapp}
              onCheckedChange={(v) => set("showWhatsapp", v)}
              label="WhatsApp düğmesi"
            />
            <Switch
              checked={h.showFavorites}
              onCheckedChange={(v) => set("showFavorites", v)}
              label="Favoriler simgesi"
            />
            <Switch
              checked={ctaOn}
              onCheckedChange={setCtaOn}
              label="Çağrı düğmesi"
              description="Telefon düğmesinin yerine özel bir düğme (ör. Değerleme talebi)."
            />
            {ctaOn && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Düğme yazısı" htmlFor="h-cta-label">
                  <Input
                    id="h-cta-label"
                    maxLength={40}
                    value={cta.label}
                    onChange={(e) =>
                      setCta((c) => ({ ...c, label: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="Bağlantı"
                  htmlFor="h-cta-href"
                  hint="Site içi: /degerleme · dış: https://…"
                >
                  <Input
                    id="h-cta-href"
                    maxLength={300}
                    value={cta.href}
                    onChange={(e) =>
                      setCta((c) => ({ ...c, href: e.target.value }))
                    }
                  />
                </Field>
              </div>
            )}
          </div>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-[15px] font-bold">Telefon (mobil)</h2>
          <div className="mt-4 space-y-4">
            <Switch
              checked={h.mobile.showPhone}
              onCheckedChange={(v) =>
                set("mobile", { ...h.mobile, showPhone: v })
              }
              label="Başlıkta arama simgesi"
            />
            <Switch
              checked={h.mobile.showWhatsapp}
              onCheckedChange={(v) =>
                set("mobile", { ...h.mobile, showWhatsapp: v })
              }
              label="Menüde WhatsApp düğmesi"
            />
          </div>
        </section>
        <p className="text-[13px] text-muted-foreground">
          Logo Marka sekmesinden, menü öğeleri Menü sekmesinden yönetilir.
        </p>
        <SaveBar
          pending={pending}
          dirty={dirty}
          onSave={() => void save(value)}
          onReset={() => {
            setH(initial);
            setCtaOn(Boolean(initial.cta));
          }}
        />
      </div>
      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <p className="mb-2 text-[12.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          Önizleme
        </p>
        <LivePreview
          config={{ ...preview.draft, header: value }}
          brand={preview.brand}
          darkAllowed={preview.darkAllowed}
          name={preview.name}
        />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Menü
const INTERNAL_PAGES: { href: string; label: string }[] = [
  { href: "/", label: "Ana sayfa" },
  { href: "/ilanlar", label: "Tüm ilanlar" },
  { href: "/satilik", label: "Satılık" },
  { href: "/kiralik", label: "Kiralık" },
  { href: "/konut", label: "Konut" },
  { href: "/ticari", label: "Ticari" },
  { href: "/arsa", label: "Arsa" },
  { href: "/bolgeler", label: "Bölgeler" },
  { href: "/hizmetlerimiz", label: "Hizmetlerimiz" },
  { href: "/degerleme", label: "Değerleme" },
  { href: "/blog", label: "Blog / Rehber" },
  { href: "/hakkimizda", label: "Hakkımızda" },
  { href: "/iletisim", label: "İletişim" },
];

function LinkEditor({
  label,
  href,
  onChange,
}: {
  label: string;
  href: string;
  onChange: (v: { label: string; href: string }) => void;
}) {
  const known = INTERNAL_PAGES.some((p) => p.href === href);
  const [custom, setCustom] = useState(!known);
  return (
    <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
      <Input
        aria-label="Menü yazısı"
        value={label}
        maxLength={40}
        onChange={(e) => onChange({ label: e.target.value, href })}
        placeholder="Yazı"
      />
      {custom ? (
        <div className="flex gap-2">
          <Input
            aria-label="Bağlantı adresi"
            value={href}
            maxLength={300}
            onChange={(e) => onChange({ label, href: e.target.value })}
            placeholder="/sayfa veya https://…"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCustom(false)}
          >
            Sayfa seç
          </Button>
        </div>
      ) : (
        <Select
          aria-label="Bağlantı"
          value={href}
          onChange={(e) => {
            if (e.target.value === "__custom") setCustom(true);
            else
              onChange({
                label:
                  label ||
                  (INTERNAL_PAGES.find((p) => p.href === e.target.value)
                    ?.label ??
                    ""),
                href: e.target.value,
              });
          }}
        >
          {INTERNAL_PAGES.map((p) => (
            <option key={p.href} value={p.href}>
              {p.label} ({p.href})
            </option>
          ))}
          <option value="__custom">Özel adres / dış bağlantı…</option>
        </Select>
      )}
    </div>
  );
}

export function NavigationForm({
  orgId,
  initial,
  defaults,
}: {
  orgId: string;
  initial: NavItemConfig[] | null;
  defaults: NavItemConfig[];
}) {
  const start = initial ?? defaults;
  const [items, setItems] = useState<NavItemConfig[]>(start);
  const { save, pending } = useSectionSave(orgId, "navigation");
  const dirty =
    JSON.stringify(items) !== JSON.stringify(start) || initial === null;
  const update = (i: number, patch: Partial<NavItemConfig>) =>
    setItems((list) =>
      list.map((it, j) => (j === i ? { ...it, ...patch } : it)),
    );
  return (
    <div className="max-w-4xl">
      {initial === null && (
        <p className="mb-4 rounded-xl bg-info-soft px-4 py-3 text-[13.5px] text-info">
          Şu an varsayılan menü kullanılıyor. Aşağıda düzenleyip kaydederseniz
          sitenin menüsü bu liste olur (masaüstü ve mobil).
        </p>
      )}
      <ol className="space-y-2">
        {items.map((it, i) => (
          <li
            key={it.id}
            className={cn(
              "rounded-2xl border border-border bg-surface p-3",
              !it.visible && "opacity-60",
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <LinkEditor
                label={it.label}
                href={it.href}
                onChange={(v) => update(i, v)}
              />
              <RowControls
                label={it.label || "Öğe"}
                index={i}
                count={items.length}
                visible={it.visible}
                onToggle={() => update(i, { visible: !it.visible })}
                onMove={(d) => setItems((l) => move(l, i, d))}
                onRemove={() => setItems((l) => l.filter((_, j) => j !== i))}
              />
            </div>
            {it.children.length > 0 && (
              <ul className="mt-2 space-y-2 border-l-2 border-border pl-3">
                {it.children.map((c, k) => (
                  <li
                    key={c.id}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    <LinkEditor
                      label={c.label}
                      href={c.href}
                      onChange={(v) =>
                        update(i, {
                          children: it.children.map((x, m) =>
                            m === k ? { ...x, ...v } : x,
                          ),
                        })
                      }
                    />
                    <RowControls
                      label={c.label || "Alt öğe"}
                      index={k}
                      count={it.children.length}
                      visible={c.visible}
                      onToggle={() =>
                        update(i, {
                          children: it.children.map((x, m) =>
                            m === k ? { ...x, visible: !x.visible } : x,
                          ),
                        })
                      }
                      onMove={(d) =>
                        update(i, { children: move(it.children, k, d) })
                      }
                      onRemove={() =>
                        update(i, {
                          children: it.children.filter((_, m) => m !== k),
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="mt-2"
              disabled={it.children.length >= 12}
              onClick={() =>
                update(i, {
                  children: [
                    ...it.children,
                    {
                      id: newId("alt"),
                      label: "Satılık",
                      href: "/satilik",
                      visible: true,
                    },
                  ],
                })
              }
            >
              <ChevronDown /> Açılır alt öğe ekle
            </Button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={items.length >= 12}
          onClick={() =>
            setItems((l) => [
              ...l,
              {
                id: newId("menu"),
                label: "İletişim",
                href: "/iletisim",
                visible: true,
                children: [],
              },
            ])
          }
        >
          <Plus /> Menü öğesi ekle
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setItems(defaults)}
        >
          Varsayılan menüye dön
        </Button>
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        Gizlenen sayfalar ve kapalı özellikler (ör. blog) menüde otomatik olarak
        gösterilmez.
      </p>
      <SaveBar
        pending={pending}
        dirty={dirty}
        onSave={() => void save(items)}
        onReset={() => setItems(start)}
      />
    </div>
  );
}

// --------------------------------------------------------------------------- Ana sayfa
const SECTION_NAMES: Record<HomeSectionType, string> = {
  hero: "Hero (arama)",
  showcase: "Öne çıkan ilanlar",
  categories: "Kategoriler",
  latest: "Yeni ilanlar",
  regions: "Bölgeler",
  process: "Çalışma şeklimiz",
  owner_cta: "Mülk sahipleri (değerleme çağrısı)",
  text: "Metin bölümü",
  blog: "Blog / Rehber",
  contact: "İletişim",
};

export function HomeForm({
  orgId,
  initial,
}: {
  orgId: string;
  initial: HomeSectionConfig[] | null;
}) {
  const start = initial ?? DEFAULT_HOME_SECTIONS;
  const [sections, setSections] = useState<HomeSectionConfig[]>(start);
  const [open, setOpen] = useState<string | null>(null);
  const { save, pending } = useSectionSave(orgId, "home");
  const dirty =
    JSON.stringify(sections) !== JSON.stringify(start) || initial === null;
  const update = (i: number, patch: Partial<HomeSectionConfig>) =>
    setSections((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const missing = DEFAULT_HOME_SECTIONS.filter(
    (d) => !sections.some((s) => s.type === d.type),
  );
  return (
    <div className="max-w-4xl">
      <ol className="space-y-2">
        {sections.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "rounded-2xl border border-border bg-surface",
              !s.enabled && "opacity-70",
            )}
          >
            <div className="flex items-center gap-2 p-3">
              <span className="numeric flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[12px] font-bold">
                {i + 1}
              </span>
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setOpen(open === s.id ? null : s.id)}
                aria-expanded={open === s.id}
              >
                <span className="block truncate text-[14px] font-semibold">
                  {s.title ?? SECTION_NAMES[s.type]}
                </span>
                <span className="block text-[12px] text-muted-foreground">
                  {SECTION_NAMES[s.type]}
                  {!s.enabled ? " · gizli" : ""}
                </span>
              </button>
              <RowControls
                label={SECTION_NAMES[s.type]}
                index={i}
                count={sections.length}
                visible={s.enabled}
                onToggle={() => update(i, { enabled: !s.enabled })}
                onMove={(d) => setSections((l) => move(l, i, d))}
                onRemove={
                  s.type === "text"
                    ? () => setSections((l) => l.filter((_, j) => j !== i))
                    : undefined
                }
              />
            </div>
            {open === s.id && (
              <div className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2">
                <Field label="Üst etiket" htmlFor={`${s.id}-eyebrow`} optional>
                  <Input
                    id={`${s.id}-eyebrow`}
                    maxLength={40}
                    value={s.eyebrow ?? ""}
                    onChange={(e) =>
                      update(i, { eyebrow: e.target.value || undefined })
                    }
                  />
                </Field>
                <Field
                  label="Başlık"
                  htmlFor={`${s.id}-title`}
                  optional
                  hint="Boş bırakılırsa varsayılan başlık"
                >
                  <Input
                    id={`${s.id}-title`}
                    maxLength={120}
                    value={s.title ?? ""}
                    onChange={(e) =>
                      update(i, { title: e.target.value || undefined })
                    }
                  />
                </Field>
                <Field
                  label="Açıklama"
                  htmlFor={`${s.id}-desc`}
                  optional
                  className="sm:col-span-2"
                >
                  <Textarea
                    id={`${s.id}-desc`}
                    rows={2}
                    maxLength={400}
                    value={s.description ?? ""}
                    onChange={(e) =>
                      update(i, { description: e.target.value || undefined })
                    }
                  />
                </Field>
                {s.type === "text" && (
                  <Field
                    label="Metin"
                    htmlFor={`${s.id}-body`}
                    hint="Paragrafları boş satırla ayırın."
                    className="sm:col-span-2"
                  >
                    <Textarea
                      id={`${s.id}-body`}
                      rows={6}
                      maxLength={4000}
                      value={s.body ?? ""}
                      onChange={(e) =>
                        update(i, { body: e.target.value || undefined })
                      }
                    />
                  </Field>
                )}
                {s.type !== "hero" &&
                  s.type !== "categories" &&
                  s.type !== "process" &&
                  s.type !== "contact" && (
                    <>
                      <Field
                        label="Düğme yazısı"
                        htmlFor={`${s.id}-cta`}
                        optional
                      >
                        <Input
                          id={`${s.id}-cta`}
                          maxLength={40}
                          value={s.ctaLabel ?? ""}
                          onChange={(e) =>
                            update(i, { ctaLabel: e.target.value || undefined })
                          }
                        />
                      </Field>
                      <Field
                        label="Düğme bağlantısı"
                        htmlFor={`${s.id}-href`}
                        optional
                        hint="/ilanlar veya https://…"
                      >
                        <Input
                          id={`${s.id}-href`}
                          maxLength={300}
                          value={s.ctaHref ?? ""}
                          onChange={(e) =>
                            update(i, { ctaHref: e.target.value || undefined })
                          }
                        />
                      </Field>
                    </>
                  )}
                {s.type === "hero" && (
                  <p className="text-[12.5px] text-muted-foreground sm:col-span-2">
                    Hero görseli Marka sekmesinden; düzeni (fotoğraf üstü /
                    ortalı / bölünmüş) temadan gelir.
                  </p>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sections.length >= 20}
          onClick={() => {
            const id = newId("metin");
            setSections((l) => [
              ...l,
              {
                id,
                type: "text",
                enabled: true,
                title: "Hakkımızda",
                body: "",
                eyebrow: undefined,
                description: undefined,
                ctaLabel: undefined,
                ctaHref: undefined,
              },
            ]);
            setOpen(id);
          }}
        >
          <Plus /> Metin bölümü ekle
        </Button>
        {missing.map((m) => (
          <Button
            key={m.type}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSections((l) => [...l, m])}
          >
            <Plus /> {SECTION_NAMES[m.type]}
          </Button>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        Bölümleri gizleyebilir, sıralayabilir ve metinlerini
        değiştirebilirsiniz. Müşteri yorumu gibi doğrulanmamış içerik bölümü
        yoktur.
      </p>
      <SaveBar
        pending={pending}
        dirty={dirty}
        onSave={() => void save({ sections })}
        onReset={() => setSections(start)}
      />
    </div>
  );
}

// --------------------------------------------------------------------------- Footer
export function FooterForm({
  orgId,
  initial,
  defaults,
}: {
  orgId: string;
  initial: FooterConfig;
  defaults: NonNullable<FooterConfig["columns"]>;
}) {
  const [f, setF] = useState<FooterConfig>(initial);
  const { save, pending } = useSectionSave(orgId, "footer");
  const columns = f.columns ?? [];
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const setColumns = (cols: NonNullable<FooterConfig["columns"]>) =>
    setF((x) => ({ ...x, columns: cols }));
  return (
    <div className="max-w-4xl space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-[15px] font-bold">İçerik</h2>
        <div className="mt-4 space-y-4">
          <Field
            label="Kısa açıklama"
            htmlFor="f-about"
            optional
            hint="Boşsa şirket sloganı kullanılır."
          >
            <Textarea
              id="f-about"
              rows={2}
              maxLength={300}
              value={f.about ?? ""}
              onChange={(e) =>
                setF((x) => ({ ...x, about: e.target.value || undefined }))
              }
            />
          </Field>
          <Field
            label="Telif yazısı"
            htmlFor="f-copy"
            optional
            hint="Boşsa: “Ticari unvan. Tüm hakları saklıdır.”"
          >
            <Input
              id="f-copy"
              maxLength={160}
              value={f.copyright ?? ""}
              onChange={(e) =>
                setF((x) => ({ ...x, copyright: e.target.value || undefined }))
              }
            />
          </Field>
          <Switch
            checked={f.showContact}
            onCheckedChange={(v) => setF((x) => ({ ...x, showContact: v }))}
            label="İletişim bilgileri"
          />
          <Switch
            checked={f.showHours}
            onCheckedChange={(v) => setF((x) => ({ ...x, showHours: v }))}
            label="Çalışma saatleri"
          />
          <Switch
            checked={f.showSocial}
            onCheckedChange={(v) => setF((x) => ({ ...x, showSocial: v }))}
            label="Sosyal medya"
          />
          <p className="text-[12.5px] text-muted-foreground">
            KVKK, gizlilik, çerez ve kullanım koşulları bağlantıları yasal
            gereklilik nedeniyle her zaman gösterilir.
          </p>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold">Bağlantı sütunları</h2>
          {!f.columns && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setColumns(defaults)}
            >
              Varsayılan sütunları düzenle
            </Button>
          )}
        </div>
        {!f.columns ? (
          <p className="mt-3 text-[13.5px] text-muted-foreground">
            Varsayılan sütunlar kullanılıyor (İlanlar, Bölgeler, Kurumsal).
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {columns.map((c, ci) => (
              <div key={c.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    aria-label="Sütun başlığı"
                    value={c.title}
                    maxLength={40}
                    onChange={(e) =>
                      setColumns(
                        columns.map((x, j) =>
                          j === ci ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <RowControls
                    label={c.title}
                    index={ci}
                    count={columns.length}
                    onMove={(d) => setColumns(move(columns, ci, d))}
                    onRemove={() =>
                      setColumns(columns.filter((_, j) => j !== ci))
                    }
                  />
                </div>
                <ul className="mt-2 space-y-2">
                  {c.links.map((l, li) => (
                    <li
                      key={l.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center"
                    >
                      <LinkEditor
                        label={l.label}
                        href={l.href}
                        onChange={(v) =>
                          setColumns(
                            columns.map((x, j) =>
                              j === ci
                                ? {
                                    ...x,
                                    links: x.links.map((y, k) =>
                                      k === li ? { ...y, ...v } : y,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <RowControls
                        label={l.label}
                        index={li}
                        count={c.links.length}
                        visible={l.visible}
                        onToggle={() =>
                          setColumns(
                            columns.map((x, j) =>
                              j === ci
                                ? {
                                    ...x,
                                    links: x.links.map((y, k) =>
                                      k === li
                                        ? { ...y, visible: !y.visible }
                                        : y,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                        onMove={(d) =>
                          setColumns(
                            columns.map((x, j) =>
                              j === ci
                                ? { ...x, links: move(x.links, li, d) }
                                : x,
                            ),
                          )
                        }
                        onRemove={() =>
                          setColumns(
                            columns.map((x, j) =>
                              j === ci
                                ? {
                                    ...x,
                                    links: x.links.filter((_, k) => k !== li),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </li>
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="mt-2"
                  disabled={c.links.length >= 12}
                  onClick={() =>
                    setColumns(
                      columns.map((x, j) =>
                        j === ci
                          ? {
                              ...x,
                              links: [
                                ...x.links,
                                {
                                  id: newId("link"),
                                  label: "İletişim",
                                  href: "/iletisim",
                                  visible: true,
                                },
                              ],
                            }
                          : x,
                      ),
                    )
                  }
                >
                  <Plus /> Bağlantı ekle
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={columns.length >= 4}
                onClick={() =>
                  setColumns([
                    ...columns,
                    { id: newId("sutun"), title: "Bağlantılar", links: [] },
                  ])
                }
              >
                <Plus /> Sütun ekle
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setF((x) => ({ ...x, columns: undefined }))}
              >
                Varsayılan sütunlara dön
              </Button>
            </div>
          </div>
        )}
      </section>
      <SaveBar
        pending={pending}
        dirty={dirty}
        onSave={() => void save(f)}
        onReset={() => setF(initial)}
      />
    </div>
  );
}

// --------------------------------------------------------------------------- Sayfalar
const PAGE_META: Record<PageKey, { name: string; path: string }> = {
  hakkimizda: { name: "Hakkımızda", path: "/hakkimizda" },
  hizmetlerimiz: { name: "Hizmetlerimiz", path: "/hizmetlerimiz" },
  iletisim: { name: "İletişim", path: "/iletisim" },
  degerleme: { name: "Değerleme talebi", path: "/degerleme" },
  blog: { name: "Blog / Rehber", path: "/blog" },
  bolgeler: { name: "Bölgeler", path: "/bolgeler" },
};

export function PagesForm({
  orgId,
  initial,
}: {
  orgId: string;
  initial: Partial<Record<PageKey, PageSettings>>;
}) {
  const [pages, setPages] = useState(initial);
  const [open, setOpen] = useState<PageKey | null>(null);
  const { save, pending } = useSectionSave(orgId, "pages");
  const dirty = JSON.stringify(pages) !== JSON.stringify(initial);
  const get = (k: PageKey): PageSettings =>
    pages[k] ?? {
      visible: true,
      title: undefined,
      seoTitle: undefined,
      seoDescription: undefined,
      ogTitle: undefined,
      ogDescription: undefined,
    };
  const set = (k: PageKey, patch: Partial<PageSettings>) =>
    setPages((p) => ({ ...p, [k]: { ...get(k), ...patch } }));
  return (
    <div className="max-w-4xl">
      <ul className="space-y-2">
        {PAGE_KEYS.map((k) => {
          const p = get(k);
          return (
            <li key={k} className="rounded-2xl border border-border bg-surface">
              <div className="flex flex-wrap items-center gap-3 p-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setOpen(open === k ? null : k)}
                  aria-expanded={open === k}
                >
                  <span className="block text-[14px] font-semibold">
                    {p.title ?? PAGE_META[k].name}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">
                    {PAGE_META[k].path}
                    {p.seoTitle ? " · SEO başlığı özel" : ""}
                  </span>
                </button>
                <label className="flex items-center gap-2 text-[13px] font-semibold">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={p.visible}
                    onChange={(e) => set(k, { visible: e.target.checked })}
                  />
                  Yayında
                </label>
              </div>
              {open === k && (
                <div className="grid grid-cols-1 gap-3 border-t border-border p-4 sm:grid-cols-2">
                  <Field label="Sayfa başlığı" htmlFor={`${k}-title`} optional>
                    <Input
                      id={`${k}-title`}
                      maxLength={80}
                      value={p.title ?? ""}
                      onChange={(e) =>
                        set(k, { title: e.target.value || undefined })
                      }
                    />
                  </Field>
                  <Field
                    label="SEO başlığı"
                    htmlFor={`${k}-seot`}
                    optional
                    hint={`${(p.seoTitle ?? "").length}/70`}
                  >
                    <Input
                      id={`${k}-seot`}
                      maxLength={70}
                      value={p.seoTitle ?? ""}
                      onChange={(e) =>
                        set(k, { seoTitle: e.target.value || undefined })
                      }
                    />
                  </Field>
                  <Field
                    label="SEO açıklaması"
                    htmlFor={`${k}-seod`}
                    optional
                    className="sm:col-span-2"
                    hint={`${(p.seoDescription ?? "").length}/200`}
                  >
                    <Textarea
                      id={`${k}-seod`}
                      rows={2}
                      maxLength={200}
                      value={p.seoDescription ?? ""}
                      onChange={(e) =>
                        set(k, { seoDescription: e.target.value || undefined })
                      }
                    />
                  </Field>
                  <Field
                    label="Paylaşım başlığı (OG)"
                    htmlFor={`${k}-ogt`}
                    optional
                  >
                    <Input
                      id={`${k}-ogt`}
                      maxLength={90}
                      value={p.ogTitle ?? ""}
                      onChange={(e) =>
                        set(k, { ogTitle: e.target.value || undefined })
                      }
                    />
                  </Field>
                  <Field
                    label="Paylaşım açıklaması (OG)"
                    htmlFor={`${k}-ogd`}
                    optional
                  >
                    <Input
                      id={`${k}-ogd`}
                      maxLength={200}
                      value={p.ogDescription ?? ""}
                      onChange={(e) =>
                        set(k, { ogDescription: e.target.value || undefined })
                      }
                    />
                  </Field>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[13px] text-muted-foreground">
        Sayfa metinleri ofisin panelinde (İçerikler) düzenlenir. Gizlenen sayfa
        sitede 404 döner ve menüden çıkar. Adresler (slug) SEO ve paylaşılmış
        bağlantılar bozulmasın diye sabittir. Yasal sayfalar (KVKK vb.) her
        zaman yayındadır.
      </p>
      <SaveBar
        pending={pending}
        dirty={dirty}
        onSave={() => void save(pages)}
        onReset={() => setPages(initial)}
      />
    </div>
  );
}

// --------------------------------------------------------------------------- SEO
export function SeoForm({
  orgId,
  initial,
  fallback,
}: {
  orgId: string;
  initial: SeoConfig;
  fallback: { title: string; description: string };
}) {
  const [s, setS] = useState<SeoConfig>(initial);
  const { save, pending } = useSectionSave(orgId, "seo");
  const dirty = JSON.stringify(s) !== JSON.stringify(initial);
  const title = s.title ?? fallback.title;
  const description = s.description ?? fallback.description;
  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <Field
          label="Site başlığı"
          htmlFor="seo-title"
          optional
          hint={`${(s.title ?? "").length}/70 · boşsa: ${fallback.title}`}
        >
          <Input
            id="seo-title"
            maxLength={70}
            value={s.title ?? ""}
            onChange={(e) =>
              setS((x) => ({ ...x, title: e.target.value || undefined }))
            }
          />
        </Field>
        <Field
          label="Meta açıklama"
          htmlFor="seo-desc"
          optional
          hint={`${(s.description ?? "").length}/200`}
        >
          <Textarea
            id="seo-desc"
            rows={3}
            maxLength={200}
            value={s.description ?? ""}
            onChange={(e) =>
              setS((x) => ({ ...x, description: e.target.value || undefined }))
            }
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Arama motorları"
            htmlFor="seo-robots"
            hint="Demo ortamı her durumda kapalıdır."
          >
            <Select
              id="seo-robots"
              value={s.robots}
              onChange={(e) =>
                setS((x) => ({
                  ...x,
                  robots: e.target.value as SeoConfig["robots"],
                }))
              }
            >
              <option value="index">Açık (index)</option>
              <option value="noindex">Kapalı (noindex)</option>
            </Select>
          </Field>
          <Field
            label="Yapılandırılmış veri türü"
            htmlFor="seo-schema"
            hint="Adres tanımlıysa kullanılır (Google)."
          >
            <Select
              id="seo-schema"
              value={s.schemaType}
              onChange={(e) =>
                setS((x) => ({
                  ...x,
                  schemaType: e.target.value as SeoConfig["schemaType"],
                }))
              }
            >
              <option value="RealEstateAgent">
                RealEstateAgent (emlak ofisi)
              </option>
              <option value="LocalBusiness">LocalBusiness</option>
              <option value="Organization">Organization</option>
            </Select>
          </Field>
          <Field
            label="Fiyat aralığı (schema)"
            htmlFor="seo-price"
            optional
            hint="Ör. ₺₺"
          >
            <Input
              id="seo-price"
              maxLength={20}
              value={s.priceRange ?? ""}
              onChange={(e) =>
                setS((x) => ({ ...x, priceRange: e.target.value || undefined }))
              }
            />
          </Field>
        </div>
        <p className="text-[13px] text-muted-foreground">
          Site haritası (sitemap.xml) ve kanonik adresler otomatik üretilir.
          İlan SEO’su ilan düzenleyicisindedir. Paylaşım görseli Marka
          sekmesinden yüklenir.
        </p>
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-[12.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          Arama sonucu önizlemesi
        </p>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="truncate text-[17px] text-[#1a0dab]">{title}</p>
          <p className="mt-1 line-clamp-3 text-[13px] text-[#4d5156]">
            {description}
          </p>
        </div>
      </div>
      <div className="lg:col-span-2">
        <SaveBar
          pending={pending}
          dirty={dirty}
          onSave={() => void save(s)}
          onReset={() => setS(initial)}
        />
      </div>
    </div>
  );
}
