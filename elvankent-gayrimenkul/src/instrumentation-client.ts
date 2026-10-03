import { reportClientError } from '@/modules/monitoring/client';

/**
 * Tarayıcıda yakalanmayan hatalar ve reddedilen promise'ler raporlanır.
 * Tarayıcı eklentileri gibi başka kaynaklardan gelen hatalar yok sayılır.
 */
try {
  window.addEventListener('error', (event) => {
    if (event.filename && !event.filename.startsWith(window.location.origin)) return;
    reportClientError(event.error ?? event.message, 'window');
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event.reason, 'promise');
  });
} catch {
  // izleme kurulamazsa uygulama etkilenmez
}
