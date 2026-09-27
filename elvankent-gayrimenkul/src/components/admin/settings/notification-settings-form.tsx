'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Save, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Switch } from '@/components/ui/form-controls';
import { saveNotificationSettings, sendTestNotification } from '@/app/actions/admin-settings';

const MAX = 5;

export function NotificationSettingsForm({
  initial,
  fallbackEmail,
  emailReady,
}: {
  initial: { notify_new_lead: boolean; emails: string[] };
  /** Adres girilmezse bildirimlerin gideceği şirket e-postası */
  fallbackEmail: string | null;
  /** Sunucuda e-posta sağlayıcısı yapılandırılmış mı */
  emailReady: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial.notify_new_lead);
  const [emails, setEmails] = useState<string[]>(initial.emails.length ? initial.emails : ['']);
  const [pending, setPending] = useState<'save' | 'test' | null>(null);

  const update = (i: number, value: string) => setEmails((list) => list.map((e, j) => (j === i ? value : e)));

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending('save');
        const res = await saveNotificationSettings({ notify_new_lead: enabled, emails: emails.map((x) => x.trim()).filter(Boolean) });
        setPending(null);
        if (!res.ok) return toast.error(res.fieldErrors?.emails?.[0] ?? res.error);
        toast.success(res.message ?? 'Kaydedildi.');
        router.refresh();
      }}
    >
      <Switch
        checked={enabled}
        onCheckedChange={setEnabled}
        label="Yeni talepte e-posta gönder"
        description="Web sitesindeki formlardan (bilgi, randevu, değerleme, iletişim) gelen her talep için bildirim."
      />
      <Field
        label="Bildirim alacak e-posta adresleri"
        htmlFor="notify-email-0"
        hint={`En fazla ${MAX} adres. Boş bırakılırsa şirket e-postasına gönderilir${fallbackEmail ? ` (${fallbackEmail})` : ' (şu an tanımlı değil)'}.`}
      >
        <ul className="space-y-2">
          {emails.map((value, i) => (
            <li key={i} className="flex gap-2">
              <Input
                id={`notify-email-${i}`}
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-label={`Bildirim e-postası ${i + 1}`}
                value={value}
                onChange={(e) => update(i, e.target.value)}
                placeholder="ornek@alanadiniz.com"
                maxLength={160}
              />
              {emails.length > 1 && (
                <Button type="button" variant="ghost" size="icon" aria-label={`${i + 1}. adresi kaldır`} onClick={() => setEmails((l) => l.filter((_, j) => j !== i))}>
                  <X />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {emails.length < MAX && (
          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setEmails((l) => [...l, ''])}>
            <Plus /> Adres ekle
          </Button>
        )}
      </Field>
      {!emailReady && (
        <p className="rounded-xl bg-warning-soft p-3 text-[13px] leading-relaxed text-warning">
          E-posta gönderimi sunucuda henüz yapılandırılmadı. Talepler panelde görünmeye devam eder; e-posta için platform yöneticisinin gönderim servisini
          (Resend) ve alan adı doğrulamasını (SPF/DKIM) tamamlaması gerekir.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending !== null}>
          <Save /> {pending === 'save' ? 'Kaydediliyor…' : 'Bildirimleri kaydet'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null || !emailReady}
          onClick={async () => {
            setPending('test');
            const res = await sendTestNotification();
            setPending(null);
            if (!res.ok) return toast.error(res.error);
            toast.success(res.message ?? 'Gönderildi.');
            router.refresh();
          }}
        >
          <Send /> {pending === 'test' ? 'Gönderiliyor…' : 'Test e-postası gönder'}
        </Button>
      </div>
    </form>
  );
}
