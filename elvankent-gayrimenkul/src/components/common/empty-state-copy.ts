/**
 * Bağlama duyarlı boş durum metinleri (saf veri; test edilebilir). Metinler dürüsttür:
 * yanıt süresi, geri arama veya bildirim vaadi içermez.
 */
export type EmptyVariant = 'filtered' | 'no-listings' | 'no-photos' | 'favorites' | 'no-region-listings';

export interface EmptyCopy {
  title: string;
  description: string;
}

export const EMPTY_COPY: Record<EmptyVariant, EmptyCopy> = {
  filtered: {
    title: 'Hiç ilan bulunamadı',
    description: 'Seçtiğiniz kriterlerin tümüne uyan yayında ilan yok. Filtreleri genişletebilir veya aradığınız özellikleri bize iletebilirsiniz.',
  },
  'no-listings': {
    title: 'Şu anda yayında ilan yok',
    description: 'Yeni ilanlar yayınlandığında bu sayfada görünür. Aradığınız bir gayrimenkul varsa özelliklerini bize iletebilirsiniz.',
  },
  'no-photos': {
    title: 'Bu ilan için henüz fotoğraf eklenmemiş.',
    description: 'Fotoğraf veya ek bilgi için ofisimize yazabilirsiniz.',
  },
  favorites: {
    title: 'Henüz favori ilanınız yok',
    description: 'Beğendiğiniz ilanlardaki kalp simgesine dokunarak favorilerinize ekleyebilir, daha sonra buradan kolayca ulaşabilirsiniz.',
  },
  'no-region-listings': {
    title: 'Bu bölgede şu anda yayında ilan bulunmuyor.',
    description: 'Bölgeyle ilgili aradığınız özellikleri bize iletebilirsiniz.',
  },
};

/** Boş sonuçta etkin filtrelere göre en fazla üç somut öneri */
export interface SuggestionInput {
  minPrice?: number;
  maxPrice?: number;
  rooms?: readonly string[];
  district?: string;
  neighborhood?: string;
  q?: string;
  /** Özellik bayrakları (krediye uygun, eşyalı vb.) açık mı */
  flagCount?: number;
  minM2?: number;
  maxM2?: number;
}

export function emptySuggestions(q: SuggestionInput): string[] {
  const out: string[] = [];
  if (q.q) out.push('Arama sözcüğünü kısaltın veya daha genel bir ifade deneyin.');
  if (q.minPrice || q.maxPrice) out.push('Fiyat aralığını genişletin.');
  if (q.rooms?.length) out.push('Oda sayısı seçimini azaltın.');
  if (q.neighborhood) out.push('Mahalle yerine ilçenin tamamına bakın.');
  else if (q.district) out.push('İlçe seçimini kaldırıp tüm bölgeye bakın.');
  if (q.minM2 || q.maxM2) out.push('Metrekare aralığını genişletin.');
  if ((q.flagCount ?? 0) > 0) out.push('Özellik filtrelerinden bazılarını kaldırın.');
  return out.slice(0, 3);
}
