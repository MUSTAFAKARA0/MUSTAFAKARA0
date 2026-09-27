'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form-controls';
import { confirmMfaEnrollment, startMfaEnrollment, verifyMfaCode, type MfaEnrollment } from '@/app/actions/mfa';

function CodeInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <Input
      id={id}
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ''))}
      placeholder="123456"
      className="numeric text-center text-[1.35rem] tracking-[0.3em]"
      autoFocus
    />
  );
}

/** Girişte: doğrulama uygulamasındaki 6 haneli kod */
export function MfaCodeForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await verifyMfaCode(code);
        if (!res.ok) {
          setPending(false);
          setError(res.fieldErrors ? Object.values(res.fieldErrors)[0]?.[0] ?? res.error : res.error);
          setCode('');
          return;
        }
        router.replace(next);
        router.refresh();
      }}
    >
      <Field label="Doğrulama kodu" htmlFor="mfa-code" error={error} hint="Telefonunuzdaki doğrulama uygulamasında görünen 6 haneli kod. Kod 30 saniyede bir yenilenir.">
        <CodeInput id="mfa-code" value={code} onChange={setCode} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={code.replace(/\s/g, '').length !== 6}>
        <ShieldCheck /> Doğrula ve devam et
      </Button>
    </form>
  );
}

/** Kurulum: QR kodu tarat, ilk kodu gir */
export function MfaEnrollForm({ next, required }: { next: string; required: boolean }) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!enrollment) {
    return (
      <div className="space-y-5 text-[14.5px] leading-relaxed">
        {required && (
          <p className="rounded-xl bg-warning-soft p-3 text-[13.5px] text-warning">
            Ofisinizin güvenlik politikası gereği panele devam etmeden önce iki adımlı doğrulamayı kurmanız gerekiyor.
          </p>
        )}
        <ol className="list-decimal space-y-2 pl-5 text-foreground/90">
          <li>Telefonunuza bir doğrulama uygulaması kurun (ör. Google Authenticator, Microsoft Authenticator veya parola yöneticiniz).</li>
          <li>Bir sonraki adımda gösterilecek QR kodunu uygulamayla taratın.</li>
          <li>Uygulamada görünen 6 haneli kodu girin.</li>
        </ol>
        <Button
          size="lg"
          className="w-full"
          loading={pending}
          onClick={async () => {
            setPending(true);
            const res = await startMfaEnrollment();
            setPending(false);
            if (!res.ok) return toast.error(res.error);
            setEnrollment(res.data);
          }}
        >
          <KeyRound /> Kuruluma başla
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const res = await confirmMfaEnrollment(enrollment.factorId, code);
        if (!res.ok) {
          setPending(false);
          setError(res.fieldErrors ? Object.values(res.fieldErrors)[0]?.[0] ?? res.error : res.error);
          setCode('');
          return;
        }
        toast.success(res.message ?? 'İki adımlı doğrulama açıldı.');
        router.replace(next);
        router.refresh();
      }}
    >
      <div className="flex flex-col items-center gap-3">
        {/* QR kodu Supabase tarafından SVG (data:) olarak üretilir; dışarıya istek yapılmaz */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qrCode} alt="Doğrulama uygulaması için QR kodu" width={192} height={192} className="size-48 rounded-xl border border-border bg-white p-2" />
        <details className="w-full text-[13px]">
          <summary className="cursor-pointer py-1 text-center font-semibold text-primary">QR kodunu tarayamıyorum</summary>
          <p className="mt-2 text-muted-foreground">Uygulamada “anahtarı elle gir” seçeneğine bu kodu yazın:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="numeric min-w-0 flex-1 rounded-lg bg-surface-muted px-3 py-2 text-[13px] break-all">{enrollment.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Anahtarı kopyala"
              onClick={async () => {
                await navigator.clipboard.writeText(enrollment.secret).catch(() => {});
                toast.success('Anahtar kopyalandı.');
              }}
            >
              <Copy />
            </Button>
          </div>
        </details>
      </div>
      <Field label="Uygulamadaki kod" htmlFor="mfa-setup-code" error={error}>
        <CodeInput id="mfa-setup-code" value={code} onChange={setCode} />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending} disabled={code.replace(/\s/g, '').length !== 6}>
        <ShieldCheck /> Kurulumu tamamla
      </Button>
    </form>
  );
}
