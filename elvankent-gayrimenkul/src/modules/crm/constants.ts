import type { Enums } from '@/types/supabase';

export type LeadStatus = Enums<'lead_status'>;
export type LeadSource = Enums<'lead_source'>;
export type LeadIntent = Enums<'lead_intent'>;
export type AppointmentStatus = Enums<'appointment_status'>;
export type ActivityKind = Enums<'lead_activity_kind'>;

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'meeting', 'appointment', 'follow_up', 'closed', 'cancelled'];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Yeni',
  contacted: 'İletişime geçildi',
  meeting: 'Görüşme',
  appointment: 'Randevu',
  follow_up: 'Takipte',
  closed: 'Kapandı',
  cancelled: 'İptal',
};

export const LEAD_STATUS_TONES: Record<LeadStatus, 'info' | 'primary-soft' | 'accent-soft' | 'warning' | 'success' | 'neutral'> = {
  new: 'info',
  contacted: 'primary-soft',
  meeting: 'accent-soft',
  appointment: 'accent-soft',
  follow_up: 'warning',
  closed: 'success',
  cancelled: 'neutral',
};

export const LEAD_SOURCES: LeadSource[] = ['website', 'whatsapp', 'phone', 'listing', 'contact_form', 'appointment', 'manual', 'qr'];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'Web sitesi',
  whatsapp: 'WhatsApp',
  phone: 'Telefon',
  listing: 'İlan sayfası',
  contact_form: 'İletişim formu',
  appointment: 'Randevu talebi',
  manual: 'Manuel giriş',
  qr: 'QR kod',
};

export const LEAD_INTENT_LABELS: Record<LeadIntent, string> = {
  buy: 'Satın almak istiyor',
  rent: 'Kiralamak istiyor',
  sell: 'Satmak istiyor',
  let: 'Kiraya vermek istiyor',
  valuation: 'Değerleme talebi',
  other: 'Diğer',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: 'Talep edildi',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
};

export const APPOINTMENT_STATUS_TONES: Record<AppointmentStatus, 'warning' | 'success' | 'neutral' | 'info'> = {
  requested: 'warning',
  confirmed: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

/** Veritabanı tetikleyicisindeki randevu geçiş kurallarının aynısı */
export const APPOINTMENT_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  requested: ['confirmed', 'cancelled', 'completed'],
  confirmed: ['completed', 'cancelled', 'requested'],
  cancelled: ['requested'],
  completed: [],
};

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  note: 'Not',
  status_change: 'Durum değişikliği',
  call: 'Telefon görüşmesi',
  whatsapp: 'WhatsApp yazışması',
  email: 'E-posta',
  meeting: 'Yüz yüze görüşme',
  system: 'Sistem',
};

export const VALUATION_CONDITIONS = [
  { value: 'yeni', label: 'Yeni / sıfır' },
  { value: 'iyi', label: 'Bakımlı' },
  { value: 'orta', label: 'Orta (küçük tadilat gerekebilir)' },
  { value: 'tadilat', label: 'Tadilat gerekli' },
] as const;
