import { BadgeCheck, FileSignature, Handshake, KeyRound, LineChart, MapPinned, MessagesSquare, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Kurumsal içerik metinleri. Gerçek olmayan rakam, ödül veya müşteri
 * yorumu içermez; işletmeye göre bu dosyadan kolayca düzenlenebilir.
 */

export interface ServiceItem {
  slug: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  details: string[];
}

export const SERVICES: ServiceItem[] = [
  {
    slug: 'satis-danismanligi',
    icon: Handshake,
    title: 'Satış Danışmanlığı',
    summary: 'Konut, iş yeri ve arsanızı doğru alıcıyla buluşturmak için ilandan tapuya kadar süreci birlikte yönetiriz.',
    details: [
      'Mülkün yerinde incelenmesi ve bilgilerin eksiksiz derlenmesi',
      'Profesyonel ilan metni ve fotoğraf hazırlığı',
      'Alıcı adaylarıyla görüşme ve randevu organizasyonu',
      'Tapu devir sürecine kadar evrak ve adım takibi',
    ],
  },
  {
    slug: 'kiralama',
    icon: KeyRound,
    title: 'Kiralama Hizmetleri',
    summary: 'Mülk sahibi ve kiracı için şeffaf, anlaşılır ve güvenli bir kiralama süreci sunarız.',
    details: [
      'Kiracı adaylarıyla ön görüşme',
      'Kira sözleşmesi hazırlığında destek',
      'Teslim ve demirbaş tutanağı düzenlenmesi',
      'Depozito ve ödeme koşullarının netleştirilmesi',
    ],
  },
  {
    slug: 'fiyat-analizi',
    icon: LineChart,
    title: 'Piyasa ve Fiyat Analizi',
    summary: 'Bölgedeki benzer ilanlar ve güncel piyasa koşullarına göre gerçekçi bir fiyat aralığı belirlemenize yardımcı oluruz.',
    details: [
      'Bölgedeki benzer ilanların karşılaştırılması',
      'Mülkün konum, yaş ve özelliklerine göre değerlendirme',
      'Satış veya kiralama stratejisi önerisi',
      'Not: Resmi değerleme raporu için SPK lisanslı değerleme uzmanlarına yönlendirme',
    ],
  },
  {
    slug: 'evrak-ve-surec',
    icon: FileSignature,
    title: 'Tapu ve Evrak Süreçleri',
    summary: 'Alım-satım ve kiralama işlemlerinde gerekli belgeler ve resmi adımlar konusunda yol gösteririz.',
    details: [
      'Tapu randevusu ve gerekli belgelerin listelenmesi',
      'İmar durumu ve tapu kaydı sorgulama adımlarında bilgilendirme',
      'Kredi ile alımlarda banka süreçlerine hazırlık',
      'İşlem sonrası teslim ve abonelik adımlarında destek',
    ],
  },
];

export interface ValueItem {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** "Neden Biz?" — çalışma ilkeleri (ölçülemeyen iddialar içermez) */
export const VALUES: ValueItem[] = [
  {
    icon: MapPinned,
    title: 'Bölgeyi Tanıyan Danışmanlık',
    text: 'Elvankent, Eryaman ve Etimesgut’un sokaklarını, ulaşım imkânlarını ve gelişen bölgelerini yakından takip ederiz.',
  },
  {
    icon: BadgeCheck,
    title: 'Doğru ve Eksiksiz İlan Bilgisi',
    text: 'İlanlarımızda metrekareden tapu durumuna kadar bilgileri açıkça paylaşır, sürprizlere yer bırakmamayı hedefleriz.',
  },
  {
    icon: MessagesSquare,
    title: 'Hızlı ve Şeffaf İletişim',
    text: 'Telefon, WhatsApp veya form üzerinden ulaştığınızda sorularınızı net ve anlaşılır şekilde yanıtlarız.',
  },
  {
    icon: ShieldCheck,
    title: 'Güvenli Süreç Yönetimi',
    text: 'Randevudan tapu devrine kadar her adımda sizi bilgilendirir, işlemlerin mevzuata uygun ilerlemesine özen gösteririz.',
  },
];

export const POPULAR_SEARCHES = [
  { label: 'Elvankent satılık daire', href: '/satilik-daire?il=ankara&ilce=etimesgut&mahalle=elvankent' },
  { label: 'Eryaman kiralık daire', href: '/kiralik-daire?il=ankara&ilce=etimesgut&mahalle=eryaman' },
  { label: 'Etimesgut arsa', href: '/arsa?il=ankara&ilce=etimesgut' },
  { label: 'Kiralık iş yeri', href: '/kiralik-isyeri' },
];
