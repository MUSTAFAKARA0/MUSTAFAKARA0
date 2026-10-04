import { redirect } from 'next/navigation';

/**
 * Eski "Site tasarımı" adresi: tasarım artık Site yönetimi › Tasarım sekmesinde, taslak → önizleme
 * → yayın akışıyla (KARAY ile aynı servis) seçilir. Ailelerin örnek verili önizlemesi
 * /admin/tasarim/onizleme adresinde kalır.
 */
export default function OfficeDesignRedirect() {
  redirect('/admin/site/tasarim');
}
