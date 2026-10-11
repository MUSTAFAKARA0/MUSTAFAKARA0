'use client';

import { createContext, useContext } from 'react';
import type { AdminMedia } from '@/modules/media/server';
import type { PropertyPatch } from '@/modules/properties/admin';
import type { EditorProperty } from '@/modules/properties/admin-queries';

export type EditableKey = keyof PropertyPatch & keyof EditorProperty;

export interface EditorTaxonomy {
  cities: { id: number; name: string; latitude: number | null; longitude: number | null }[];
  districts: { id: number; city_id: number; name: string; latitude: number | null; longitude: number | null }[];
  neighborhoods: { id: number; district_id: number; name: string; latitude: number | null; longitude: number | null }[];
  propertyTypes: { id: number; category: string; name: string }[];
  features: { id: number; label: string; feature_group: string }[];
}

export interface EditorPerms {
  update: boolean;
  publish: boolean;
  media: boolean;
  delete: boolean;
  pdf: boolean;
}

export interface EditorCtx {
  values: EditorProperty;
  set: <K extends EditableKey>(key: K, value: EditorProperty[K]) => void;
  errors: Record<string, string | undefined>;
  location: { address: string | null; latitude: number | null; longitude: number | null };
  setLocation: (next: Partial<EditorCtx['location']>) => void;
  featureIds: number[];
  setFeatureIds: (ids: number[]) => void;
  media: AdminMedia[];
  setMedia: (media: AdminMedia[]) => void;
  taxonomy: EditorTaxonomy;
  perms: EditorPerms;
  map: { attribution: string; maxZoom: number };
  readOnly: boolean;
}

export const EditorContext = createContext<EditorCtx | null>(null);

export function useEditor(): EditorCtx {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside PropertyEditor');
  return ctx;
}
