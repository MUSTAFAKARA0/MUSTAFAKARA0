'use client';

import { Input } from '@/components/ui/form-controls';

const fmt = new Intl.NumberFormat('tr-TR');

/**
 * Binlik ayraçlı sayı girişi (ör. 4.250.000). Mobilde sayısal klavye açar.
 * Değer, ayraçsız sayı dizesi olarak dışarı verilir.
 */
export function NumberInput({
  value,
  onValueChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (raw: string) => void;
}) {
  const display = value ? fmt.format(Number(value)) : '';
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 13).replace(/^0+(?=\d)/, '');
        onValueChange(digits);
      }}
    />
  );
}
