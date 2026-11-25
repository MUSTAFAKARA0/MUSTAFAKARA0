import { toast as sonner } from 'sonner';

/** Hata bildirimleri okunup anlaşılsın diye daha uzun kalır; diğer tüm davranış sonner ile aynıdır. */
export const ERROR_TOAST_MS = 8000;

type ErrorArgs = Parameters<typeof sonner.error>;

export const toast = Object.assign((...args: Parameters<typeof sonner>) => sonner(...args), sonner, {
  error: (message: ErrorArgs[0], data?: ErrorArgs[1]) => sonner.error(message, { duration: ERROR_TOAST_MS, ...data }),
});
