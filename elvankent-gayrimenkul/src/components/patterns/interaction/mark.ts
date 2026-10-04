/**
 * Etkin desenleri <html data-site-patterns="…"> özniteliğine yazar (hata ayıklama ve testler).
 * Her ada kendi işaret metnini bu fonksiyona verir; metin adanın kendi tarayıcı parçasında kalır.
 */
export function markPattern(marker: string): () => void {
  const root = document.documentElement;
  const read = () => new Set((root.getAttribute('data-site-patterns') ?? '').split(' ').filter(Boolean));
  const list = read();
  list.add(marker);
  root.setAttribute('data-site-patterns', [...list].join(' '));
  return () => {
    const next = read();
    next.delete(marker);
    if (next.size) root.setAttribute('data-site-patterns', [...next].join(' '));
    else root.removeAttribute('data-site-patterns');
  };
}
