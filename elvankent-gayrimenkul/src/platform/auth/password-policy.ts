import { z } from 'zod';

/**
 * Uygulamanın şifre kuralı (şifre değiştirme, şifre sıfırlama ve davetle hesap etkinleştirme AYNI
 * kuralı kullanır): en az 10 karakter, harf ve rakam. Supabase Auth kendi politikasını (asgari
 * uzunluk, sızdırılmış şifre denetimi vb.) ayrıca uygular; bu kural onun ÜZERİNE eklenir.
 */
export const passwordSchema = z
  .string()
  .min(10, { error: 'Şifre en az 10 karakter olmalıdır.' })
  .max(200, { error: 'Şifre çok uzun.' })
  .refine((v) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(v) && /\d/.test(v), { error: 'Şifre en az bir harf ve bir rakam içermelidir.' })
  .refine((v) => !/^(.)\1+$/.test(v), { error: 'Şifre tek bir karakterin tekrarı olamaz.' });

/** Supabase Auth'un şifre güncelleme hatasını kullanıcı mesajına çevirir */
export function authPasswordErrorMessage(message: string): string {
  return /same|different/i.test(message)
    ? 'Yeni şifre eskisinden farklı olmalıdır.'
    : /weak|pwned|leaked|characters|short/i.test(message)
      ? 'Bu şifre çok zayıf veya sızdırılmış şifreler listesinde. Lütfen başka bir şifre seçin.'
      : 'Şifre güncellenemedi. Lütfen tekrar deneyin.';
}
