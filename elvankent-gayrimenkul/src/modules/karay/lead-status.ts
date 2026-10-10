/** KARAY talep durumları (sunucu ve istemci bileşenlerinde ortak kullanılır) */
export const LEAD_STATUS: Record<string, { label: string; tone: 'info' | 'warning' | 'success' | 'neutral' }> = {
  new: { label: 'Yeni', tone: 'info' },
  contacted: { label: 'İletişime geçildi', tone: 'warning' },
  qualified: { label: 'Görüşme / teklif', tone: 'success' },
  closed: { label: 'Kapandı', tone: 'neutral' },
};
