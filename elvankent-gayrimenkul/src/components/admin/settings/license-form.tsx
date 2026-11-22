'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { TextField } from '@/components/admin/editor/fields';
import { Panel } from '@/components/panel/ui';
import { Button } from '@/components/ui/button';
import { saveLicenseNumber } from '@/app/actions/admin-settings';

/**
 * P0-8 · Yetki belgesi numarası (yasal bilgi). Taslağa değil doğrudan kaydedilir; sitenin alt bilgisinde hemen görünür.
 * Sayfa yalnız veritabanında sütun varsa (bekleyen migration G uygulanmışsa) bu kartı çizer.
 */
export function LicenseForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    const res = await saveLicenseNumber({ license_no: value });
    setPending(false);
    if (!res.ok) {
      const message = res.fieldErrors?.license_no?.[0];
      if (message) setErrors({ license_no: message });
      toast.error(res.error);
      return;
    }
    const normalized = value.replace(/\s+/g, '').toLocaleUpperCase('tr-TR');
    setValue(normalized);
    setSaved(normalized);
    toast.success(res.message ?? 'Kaydedildi.');
    router.refresh();
  }

  return (
    <Panel
      title="Yasal bilgiler"
      description="Taşınmaz ticareti yetki belgesi numaranız sitenizin alt bilgisinde (ilan sayfaları dahil) gösterilir. Hangi ilan kanallarında gösterilmesi gerektiğini danışmanınızla doğrulayın."
    >
      <form onSubmit={submit} className="space-y-4" noValidate data-testid="license-form">
        <TextField
          label="Yetki belgesi numarası"
          name="license_no"
          value={value}
          onChange={setValue}
          maxLength={40}
          errors={errors}
          placeholder="ör. 0600123"
          hint="Boş bırakırsanız sitede gösterilmez. Değişiklik taslağa değil, doğrudan sitenize kaydedilir."
        />
        <div className="flex justify-end">
          <Button type="submit" loading={pending} disabled={value === saved && !pending}>
            <Save aria-hidden /> Kaydet
          </Button>
        </div>
      </form>
    </Panel>
  );
}
