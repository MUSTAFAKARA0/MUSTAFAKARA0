'use client';

import { useEffect } from 'react';

/**
 * Kaydedilmemiş form değişikliği koruması (Site Kontrol Merkezi).
 * Kirli form sayısı modül düzeyinde tutulur: sekme bağlantıları ve yayın düğmesi
 * bu sayıya bakarak kullanıcıyı uyarır; sayfa kapatılırken tarayıcı uyarısı çıkar.
 */
let dirtyForms = 0;

export function useDirtyGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    dirtyForms += 1;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      dirtyForms -= 1;
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirty]);
}

export function hasUnsavedChanges(): boolean {
  return dirtyForms > 0;
}

/** Bağlantı tıklamasında: kaydedilmemiş değişiklik varsa onay ister */
export function confirmLeave(e: { preventDefault: () => void }) {
  if (hasUnsavedChanges() && !window.confirm('Bu sekmede kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?')) e.preventDefault();
}
