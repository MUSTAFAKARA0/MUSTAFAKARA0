import 'server-only';

/**
 * Sadece sunucuda okunabilen ortam değişkenleri.
 * `server-only` importu, bu dosyanın yanlışlıkla bir istemci bileşenine
 * dahil edilmesi durumunda build'i hata ile durdurur.
 */
export const serverEnv = {
  supabaseServiceRoleKey: (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
  ipHashSalt: (process.env.IP_HASH_SALT ?? '').trim(),
  /** Zamanlanmış görevlerin (cron) yetkilendirme sırrı */
  cronSecret: (process.env.CRON_SECRET ?? '').trim(),
  /** Bilinmeyen alan adlarında ve yerel geliştirmede gösterilecek kiracı */
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'elvankent',
  /** SaaS alt alan adları için kök alan (ör. platform.com → ofis1.platform.com) */
  platformRootDomain: (process.env.PLATFORM_ROOT_DOMAIN ?? '').toLowerCase(),
  /** Talep bildirimleri için e-posta gönderimi (bkz. src/modules/notifications/email.ts) */
  email: {
    /** resend | log (yalnızca geliştirme; içerik yazılmaz) | none */
    provider: (process.env.EMAIL_PROVIDER || 'none').toLowerCase(),
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    /** Yalnızca test için değiştirilir (sahte sunucu); varsayılan Resend API */
    resendApiBase: (process.env.RESEND_API_BASE || 'https://api.resend.com').replace(/\/+$/, ''),
    /** Alan adlı gönderici, ör. "Elvankent Gayrimenkul <bildirim@elvankentgayrimenkul.com>" */
    from: process.env.EMAIL_FROM ?? '',
    replyTo: process.env.EMAIL_REPLY_TO ?? '',
    /**
     * minimal (varsayılan): e-postada kişisel veri yok (tür, ilan, saat, panel bağlantısı).
     * full: ad, telefon, e-posta ve mesaj da yazılır — yurt dışındaki e-posta servisine
     * kişisel veri aktarımı olduğundan hukukçu onayından sonra açılmalıdır (KVKK m.9).
     */
    leadDetails: (process.env.NOTIFY_EMAIL_DETAILS === 'full' ? 'full' : 'minimal') as 'full' | 'minimal',
  },
  map: {
    // V1 uyumluluğu: yalnızca MAP_TILE_URL tanımlıysa özel döşeme sağlayıcısı kullanılır
    provider: (process.env.MAP_PROVIDER || (process.env.MAP_TILE_URL ? 'custom' : 'osm')).toLowerCase(),
    apiKey: process.env.MAP_API_KEY ?? '',
    style: process.env.MAP_STYLE ?? '',
    tileUrl: process.env.MAP_TILE_URL ?? '',
    // V1'deki NEXT_PUBLIC_MAP_ATTRIBUTION da okunur
    attribution: process.env.MAP_ATTRIBUTION || process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '',
  },
};
