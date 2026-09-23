'use server';

import { getPropertiesByIds } from '@/lib/data/properties';
import type { PropertyCardData } from '@/types/database';

/** Tarayıcıda saklanan favori ID'leri için yayındaki ilan kartları */
export async function getFavoriteCards(ids: unknown): Promise<{ ok: true; items: PropertyCardData[] } | { ok: false }> {
  if (!Array.isArray(ids)) return { ok: true, items: [] };
  try {
    const items = await getPropertiesByIds(ids.filter((x): x is string => typeof x === 'string').slice(0, 100));
    return { ok: true, items };
  } catch {
    return { ok: false };
  }
}
