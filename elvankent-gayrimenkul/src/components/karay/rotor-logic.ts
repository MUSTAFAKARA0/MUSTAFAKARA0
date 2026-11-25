/**
 * Hero'daki vurgulu satırın zamanlaması: sözcükler sırayla vurgulanır, tek geçişten sonra durağan cümleye döner.
 * Toplam otomatik hareket 5 saniyeyi geçmez (WCAG 2.2.2).
 */
export function rotorSchedule(words: readonly string[], stepMs: number): { steps: { index: number; at: number }[]; total: number; endsStatic: true } {
  const steps = words.map((_, index) => ({ index, at: index * stepMs }));
  return { steps, total: words.length * stepMs, endsStatic: true };
}
