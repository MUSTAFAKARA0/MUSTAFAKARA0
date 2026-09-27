/**
 * Next.js veri önbelleği etiketleri. Kiracıya özel veriler organizasyon
 * kimliğiyle etiketlenir; bir ofisteki değişiklik diğer ofislerin önbelleğini
 * boşaltmaz.
 */
export const cacheTags = {
  /** Kiracı (alan adı / slug) çözümlemesi */
  tenants: 'tenants',
  /** Platform geneli referans veriler: il/ilçe/mahalle, emlak tipleri, özellikler */
  taxonomy: 'taxonomy',
  /** Organizasyon ayarları ve markası */
  org: (orgId: string) => `org:${orgId}`,
  properties: (orgId: string) => `org:${orgId}:properties`,
  content: (orgId: string) => `org:${orgId}:content`,
  redirects: (orgId: string) => `org:${orgId}:redirects`,
} as const;
