import 'server-only';
import { permanentRedirect, redirect } from 'next/navigation';

/**
 * Yönetim panelinde tanımlanan yönlendirmeyi uygular. Kalıcı kurallar
 * (301/308) 308 ile, geçici kurallar (302/307) 307 ile gönderilir; Next.js
 * sayfa içi yönlendirmelerde bu iki kodu kullanır (arama motorları 308'i
 * 301 ile aynı şekilde değerlendirir).
 */
export function followRedirect(target: { to_path: string; status_code: number }): never {
  if (target.status_code === 302 || target.status_code === 307) redirect(target.to_path);
  permanentRedirect(target.to_path);
}
