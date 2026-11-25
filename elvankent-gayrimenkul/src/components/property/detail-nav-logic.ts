/** İlan detayı bölüm gezintisi: yalnızca sayfada gerçekten bulunan bölümler listelenir (saf; test edilebilir). */
export interface DetailSectionNavItem {
  id: string;
  label: string;
}

export interface DetailSectionPresence {
  description: boolean;
  features: boolean;
  map: boolean;
  similar: boolean;
}

/** Gezinti en az bu kadar bölüm varsa gösterilir */
export const MIN_NAV_ITEMS = 3;

export function buildDetailSections(p: DetailSectionPresence): DetailSectionNavItem[] {
  const items: DetailSectionNavItem[] = [{ id: 'ozet', label: 'Özet' }];
  if (p.description) items.push({ id: 'aciklama', label: 'Açıklama' });
  items.push({ id: 'ozellikler', label: 'Özellikler' });
  if (p.features) items.push({ id: 'olanaklar', label: 'Olanaklar' });
  if (p.map) items.push({ id: 'konum', label: 'Konum' });
  if (p.similar) items.push({ id: 'benzer', label: 'Benzer' });
  return items;
}
