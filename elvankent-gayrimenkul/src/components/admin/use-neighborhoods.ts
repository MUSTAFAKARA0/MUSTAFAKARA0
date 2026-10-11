'use client';

import { useEffect, useReducer } from 'react';
import { getDistrictNeighborhoods } from '@/app/actions/locations';

type Hood = { id: number; district_id: number; name: string; latitude?: number | null; longitude?: number | null };

// Sayfa ömrü boyunca ilçe → mahalleler önbelleği (adımlar arası geçişte yeniden istenmez)
const loaded = new Map<number, Hood[]>();

/**
 * Seçili ilçenin mahalleleri. Sayfa yalnızca mevcut ilçenin mahalleleriyle açılır
 * (initial); başka ilçe seçilince liste sunucudan istenir. Türkiye geneli ~50 bin
 * mahallenin tamamı tarayıcıya gönderilmez.
 */
export function useDistrictNeighborhoods<T extends Hood>(districtId: number | null | '' | undefined, initial: T[]): { items: T[]; loading: boolean } {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const id = typeof districtId === 'number' ? districtId : null;
  const fromInitial = id ? initial.filter((n) => n.district_id === id) : [];
  const cached = id ? (loaded.get(id) as T[] | undefined) : undefined;
  const needsFetch = id !== null && !cached && fromInitial.length === 0;

  useEffect(() => {
    if (!needsFetch || id === null) return;
    let alive = true;
    void getDistrictNeighborhoods(id).then((res) => {
      if (!res.ok) return;
      loaded.set(id, res.data);
      if (alive) rerender();
    });
    return () => {
      alive = false;
    };
  }, [id, needsFetch]);

  return { items: cached ?? fromInitial, loading: needsFetch };
}
