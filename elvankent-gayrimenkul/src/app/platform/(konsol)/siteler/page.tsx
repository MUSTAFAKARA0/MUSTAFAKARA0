import type { Metadata } from "next";
import Link from "@/components/common/intent-link";
import {
  ExternalLink,
  Globe,
  LayoutTemplate,
  Plus,
  Settings2,
} from "lucide-react";
import {
  AdminPageHeader,
  EmptyPanel,
  TableWrap,
  td,
  th,
} from "@/components/panel/ui";
import { PreviewButton } from "@/components/platform/site/site-actions";
import { SiteRowMenu } from "@/components/platform/site/site-row-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/format";
import { ORG_STATUS_LABELS } from "@/modules/platform/queries";
import { SITE_STATUS_META } from "@/modules/platform/sites";
import { requireSuperAdminPage } from "@/platform/auth/session";
import { THEMES } from "@/theme-engine/themes";
import type { ThemeId } from "@/platform/site/schema";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

export const metadata: Metadata = { title: "Web Siteleri" };

/** Tüm kiracı web siteleri: durum, alan adı, tema, son yayın; her biri için Site Kontrol Merkezi */
export default async function SitesPage() {
  const session = await requireSuperAdminPage();
  const { data } = await session.supabase.rpc("platform_sites");
  const sites = data ?? [];
  const siteHost = (() => {
    try {
      return new URL(publicEnv.siteUrl).host;
    } catch {
      return null;
    }
  })();
  // Kiracı çözümlemesiyle aynı kural: birincil alan adı → varsayılan kiracı → alt alan adı
  const siteUrl = (s: (typeof sites)[number]) =>
    s.org_status !== "active"
      ? null
      : s.primary_domain
        ? `https://${s.primary_domain}`
        : s.is_default || !serverEnv.platformRootDomain
          ? publicEnv.siteUrl
          : `https://${s.slug}.${serverEnv.platformRootDomain}`;
  return (
    <>
      <AdminPageHeader
        title="Web Siteleri"
        description="Müşteri ofislerinin web sitelerinin görünümünü, sayfalarını, SEO'sunu ve yayın durumunu buradan yönetin. İlanlar ve CRM ofisin kendi panelindedir."
        actions={
          <Button asChild>
            <Link href="/platform/organizasyonlar/yeni">
              <Plus /> Yeni site / müşteri
            </Link>
          </Button>
        }
      />
      {sites.length === 0 ? (
        <EmptyPanel
          icon={LayoutTemplate}
          title="Henüz site yok"
          description="Yeni bir müşteri (organizasyon) oluşturduğunuzda web sitesi otomatik olarak burada görünür."
        />
      ) : (
        <>
          {/* Masaüstü: tablo */}
          <TableWrap className="hidden rounded-2xl border border-border bg-surface shadow-xs md:block">
            <thead className="border-b border-border bg-surface-muted/50">
              <tr>
                <th className={th}>Site</th>
                <th className={th}>Durum</th>
                <th className={th}>Alan adı</th>
                <th className={th}>Tema</th>
                <th className={th}>Yayın</th>
                <th className={`${th} text-right`}>İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sites.map((s) => {
                const status =
                  SITE_STATUS_META[
                    (s.site_status as keyof typeof SITE_STATUS_META) ?? "active"
                  ] ?? SITE_STATUS_META.active;
                const org = ORG_STATUS_LABELS[s.org_status];
                const domain =
                  s.primary_domain ?? (s.is_default ? siteHost : null);
                return (
                  <tr key={s.organization_id}>
                    <td className={td}>
                      <Link
                        href={`/platform/siteler/${s.organization_id}`}
                        className="font-semibold hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="text-[12.5px] text-muted-foreground">
                        {s.slug}
                      </p>
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap gap-1.5">
                        {s.org_status !== "active" && org ? (
                          <Badge variant={org.tone}>{org.label}</Badge>
                        ) : (
                          <Badge variant={status.tone}>{status.label}</Badge>
                        )}
                        {s.has_unpublished_changes && (
                          <Badge variant="info">Yayınlanmamış değişiklik</Badge>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      {domain ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Globe
                            className="size-3.5 text-muted-foreground"
                            aria-hidden
                          />
                          {domain}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className={td}>
                      {THEMES[s.theme as ThemeId]?.name ?? s.theme}
                    </td>
                    <td className={td}>
                      {s.published_version > 0 ? (
                        <span>
                          Sürüm {s.published_version}
                          <span className="block text-[12.5px] text-muted-foreground">
                            {s.published_at
                              ? formatRelativeDate(s.published_at)
                              : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Varsayılan görünüm
                        </span>
                      )}
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex justify-end gap-1.5">
                        {s.org_status === "active" && (
                          <PreviewButton orgId={s.organization_id} size="xs" />
                        )}
                        <Button asChild size="xs">
                          <Link href={`/platform/siteler/${s.organization_id}`}>
                            <Settings2 /> Yönet
                          </Link>
                        </Button>
                        <SiteRowMenu
                          orgId={s.organization_id}
                          name={s.name}
                          siteUrl={siteUrl(s)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
          {/* Telefon: kartlar (yatay taşma yok) */}
          <ul className="space-y-3 md:hidden">
            {sites.map((s) => {
              const status =
                SITE_STATUS_META[
                  (s.site_status as keyof typeof SITE_STATUS_META) ?? "active"
                ] ?? SITE_STATUS_META.active;
              const domain =
                s.primary_domain ?? (s.is_default ? siteHost : null);
              return (
                <li
                  key={s.organization_id}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/platform/siteler/${s.organization_id}`}
                        className="font-semibold hover:underline"
                      >
                        {s.name}
                      </Link>
                      <p className="truncate text-[12.5px] text-muted-foreground">
                        {domain ?? s.slug}
                      </p>
                    </div>
                    <Badge variant={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    Tema: {THEMES[s.theme as ThemeId]?.name ?? s.theme} ·{" "}
                    {s.published_version > 0
                      ? `Sürüm ${s.published_version}`
                      : "Varsayılan görünüm"}
                    {s.has_unpublished_changes
                      ? " · yayınlanmamış değişiklik var"
                      : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/platform/siteler/${s.organization_id}`}>
                        <Settings2 /> Yönet
                      </Link>
                    </Button>
                    {s.org_status === "active" && (
                      <PreviewButton orgId={s.organization_id} size="sm" />
                    )}
                    <SiteRowMenu
                      orgId={s.organization_id}
                      name={s.name}
                      siteUrl={siteUrl(s)}
                      size="sm"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <ExternalLink className="size-3.5" aria-hidden /> Önizleme
            bağlantısı yeni sekmede açılır ve yalnızca sizin tarayıcınızda
            taslağı gösterir.
          </p>
        </>
      )}
    </>
  );
}
