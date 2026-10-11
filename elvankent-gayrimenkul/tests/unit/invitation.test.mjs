/**
 * P0.4 — Müşteri (ofis sahibi) daveti ve güvenli hesap aktivasyonu.
 *
 *  INV-01  Oluşturma: geçici şifre yok; hesap şifre verilmeden + doğrulanmamış açılır; davet aynı işlemde
 *  INV-02  Token entropisi: 32 bayt kriptografik rastgele, base64url, tekrar etmez
 *  INV-03  Token özeti: SHA-256 (64 hex); veritabanına yalnızca özet gider
 *  INV-04  Süre: tek merkez invitation_ttl() = 72 saat; başka yerde süre sabiti yok
 *  INV-05  Bekleyen durum ve geçişler: pending → accepted | revoked; expired = süresi geçmiş pending
 *  INV-06  Kabul: koşullu tek UPDATE (yarış güvenli); kullanılmış/iptal/eskimiş aynı yanıt
 *  INV-07  Tek kullanım: kabul edilen token ikinci kez kullanılamaz
 *  INV-08  İptal: yalnızca bekleyen davet; kabul edilmiş iptal edilemez; hesap silinmez
 *  INV-09  Tekrar gönder: her gönderim yeni token + yeni süre (aynı satırda özet değişir)
 *  INV-10  Eski token geçersizliği: özet değişince eski bağlantı eşleşmez (geçmiş tutulmaz)
 *  INV-11  E-posta bağı: hesabın e-postası davetin e-postası olmalı
 *  INV-12  Kiracı bağı: organizasyon token → kayıt zincirinden; istemci alanı okunmaz
 *  INV-13  Rol bağı: yalnızca owner; üyelik rolü = davet rolü; rol istemciden gelmez
 *  INV-14  Geçersiz/eskimiş token: biçim denetimi; geçersiz durumların hepsi aynı mesaj
 *  INV-15  Yetkisiz platform işlemi: requireSuperAdmin + assert_super_admin; token fonksiyonları yalnızca service_role
 *  INV-16  Kiracı izolasyonu: RLS (süper admin / users.manage), yazma politikası yok, token_hash okunmaz
 *  INV-17  Açık yönlendirme: aktivasyon yalnızca sabit /admin'e döner; next/redirect okunmaz
 *  INV-18  Mevcut kullanıcı uyumluluğu: mevcut hesap / giriş / şifre sıfırlama değişmez
 *  INV-19  Gizlilik: token loglanmaz, URL parçasında taşınır, e-posta konusunda yok
 *  INV-20  E-posta yapılandırılmamışsa token döndürülmez / davet bozulmaz; iptal hatası
 *  INV-21  Performans: davet / aktivasyon kodu ziyaretçi sitesine girmez
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createInvitationToken, hashInvitationToken, invitationLink, isInvitationTokenFormat, INVITATION_TOKEN_BYTES, ACTIVATION_PATH } from '../../src/modules/platform/invitations/token.ts';
import { buildInvitationEmail } from '../../src/modules/platform/invitations/email.ts';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(root + p, 'utf8');
const SQL = read('supabase/migrations/20261008000001_owner_invitations.sql');
const ACTIVATE = read('src/app/actions/invitation.ts');
const PROVISION = read('src/modules/platform/provisioning.ts');
const SERVICE = read('src/modules/platform/invitations/service.ts');
const fn = (name) => {
  const start = SQL.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} tanımı yok`);
  return SQL.slice(start, SQL.indexOf('\n$$;', start));
};
const strip = (s) => s.replace(/^\s*(\/\/|\*|\/\*\*).*$/gm, '');

function walk(dir) {
  return readdirSync(root + dir).flatMap((f) => {
    const p = `${dir}/${f}`;
    return statSync(root + p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe('INV-01 oluşturma: geçici şifre yok', () => {
  test('provisioning şifre üretmez, hesap şifre verilmeden ve doğrulanmamış açılır, davet özeti organizasyonla aynı RPC', () => {
    const code = strip(PROVISION);
    assert.doesNotMatch(code, /temporaryPassword|randomInt|password_change_required:\s*true|password:/);
    assert.match(code, /createUser\(\{\s*email: input\.owner_email,\s*email_confirm: false,/);
    assert.match(code, /createdUser \? createInvitationToken\(\) : null/);
    assert.match(code, /platform_create_organization', \{[\s\S]*p_invite_token_hash: invite\.hash/);
    // Organizasyon açılamazsa yeni hesap silinir (yarım müşteri kalmaz)
    assert.match(code, /if \(error\) \{\s*if \(createdUser\) await service\.auth\.admin\.deleteUser\(ownerId\);/);
  });
  test('platform işlemleri ve ekranlar geçici şifre döndürmez / göstermez', () => {
    for (const p of ['src/app/actions/platform.ts', 'src/app/actions/site-create.ts', 'src/components/platform/org-controls.tsx', 'src/components/platform/site-wizard/site-wizard.tsx', 'src/components/platform/owner-invitation.tsx']) {
      const code = strip(read(p));
      assert.doesNotMatch(code, /temporaryPassword|Geçici şifre|geçici şifre|select-all/, p);
    }
    const create = fn('platform_create_organization');
    assert.match(create, /insert into public\.organization_invitations \(organization_id, user_id, email, role, token_hash, expires_at, created_by\)/);
    assert.match(create, /values \(v_org, p_owner, v_email, 'owner', p_invite_token_hash, now\(\) \+ public\.invitation_ttl\(\)/);
  });
});

describe('INV-02/03 token entropisi ve özeti', () => {
  test('32 bayt rastgele, 43 karakter base64url, 2000 üretimde tekrar yok', () => {
    assert.equal(INVITATION_TOKEN_BYTES, 32);
    const seen = new Set();
    for (let i = 0; i < 2000; i++) {
      const { token, hash } = createInvitationToken();
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      assert.equal(Buffer.from(token, 'base64url').length, 32);
      assert.equal(hash, hashInvitationToken(token));
      seen.add(token);
    }
    assert.equal(seen.size, 2000);
    assert.match(read('src/modules/platform/invitations/token.ts'), /randomBytes\(INVITATION_TOKEN_BYTES\)/);
  });
  test('özet SHA-256 hex; deterministik; tokendan farklı; veritabanı yalnızca 64 hex kabul eder', () => {
    const { token, hash } = createInvitationToken();
    assert.equal(hash, createHash('sha256').update(token).digest('hex'));
    assert.match(hash, /^[0-9a-f]{64}$/);
    assert.notEqual(hash, token);
    assert.match(SQL, /token_hash text not null check \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/);
    // Ham token RPC'ye gönderilmez: her çağrıda özet
    assert.match(ACTIVATE, /p_token_hash: hashInvitationToken\(token\)/g);
    assert.match(SERVICE, /p_token_hash: hash \}/);
    assert.doesNotMatch(strip(SERVICE + ACTIVATE), /p_token_hash: token\b/);
  });
});

describe('INV-04 süre politikası', () => {
  test('tek merkez: invitation_ttl() = 72 saat; tüm süre atamaları onu kullanır', () => {
    assert.match(fn('invitation_ttl'), /select interval '72 hours';/);
    const assigns = SQL.match(/now\(\) \+ public\.invitation_ttl\(\)/g) ?? [];
    assert.equal(assigns.length, 3, 'oluşturma, yeniden gönderim ve yeni davet süreleri');
    // Süre başka bir sabitle atanmaz; 72 yalnızca politika fonksiyonunda
    assert.doesNotMatch(SQL, /expires_at = now\(\) \+ interval|'owner', p_\w+, now\(\) \+ interval/);
    assert.doesNotMatch(SQL.replace(fn('invitation_ttl'), ''), /'72 hours'/);
    // Uygulama kodunda ayrı süre sabiti yok
    for (const p of ['src/modules/platform/invitations/token.ts', 'src/modules/platform/invitations/service.ts', 'src/app/actions/invitation.ts']) assert.doesNotMatch(read(p), /72|3600|86400|hours/i, p);
  });
  test('süresi geçmiş davet kullanılamaz ve "expired" görünür', () => {
    assert.match(fn('_invitation_usable'), /and i\.expires_at > now\(\)/);
    assert.match(fn('invitation_accept'), /and i\.expires_at > now\(\)/);
    assert.match(fn('platform_owner_invitation'), /case when i\.status = 'pending' and i\.expires_at <= now\(\) then 'expired' else i\.status end/);
  });
});

describe('INV-05/06/07 durumlar, kabul ve tek kullanım', () => {
  test('durum kümesi ve tutarlılık kısıtları', () => {
    assert.match(SQL, /status text not null default 'pending' check \(status in \('pending', 'accepted', 'revoked'\)\)/);
    assert.match(SQL, /check \(\(status = 'accepted'\) = \(accepted_at is not null\)\)/);
    assert.match(SQL, /check \(\(status = 'revoked'\) = \(revoked_at is not null\)\)/);
    assert.match(SQL, /unique index if not exists organization_invitations_pending_idx\s+on public\.organization_invitations \(organization_id, email\) where status = 'pending'/);
  });
  test('kabul koşullu tek UPDATE: yalnızca pending + aynı özet + süresi geçmemiş; satır yoksa invalid', () => {
    const accept = fn('invitation_accept');
    assert.match(accept, /set status = 'accepted', accepted_at = now\(\)\s+where i\.id = v_inv\.id and i\.status = 'pending' and i\.token_hash = p_token_hash and i\.expires_at > now\(\)/);
    assert.match(accept, /if v_inv\.id is null or v_inv\.status <> 'accepted' then[\s\S]*'invalid'/);
    // Geçersiz / kullanılmış / iptal / eskimiş: aynı tek yanıt
    assert.equal((accept.match(/'invalid'::text/g) ?? []).length, 1);
    assert.equal((fn('invitation_lookup').match(/'invalid'::text/g) ?? []).length, 1);
  });
  test('aktivasyon: kabul sonucu ok değilse işlem durur; telafi yalnızca şifre atanamazsa', () => {
    const code = strip(ACTIVATE);
    assert.match(code, /if \(claim\.result !== 'ok' \|\| !claim\.user_id \|\| !claim\.organization_id \|\| !claim\.email \|\| !claim\.invitation_id\) return \{ error: INVALID, invalid: true \};/);
    const acceptAt = code.indexOf("rpc('invitation_accept'");
    const passwordAt = code.indexOf('updateUserById(claim.user_id');
    const signInAt = code.indexOf('signInWithPassword');
    assert.ok(acceptAt > 0 && acceptAt < passwordAt && passwordAt < signInAt, 'sıra: kabul → şifre → oturum');
    assert.match(code, /if \(updated\.error\) \{\s*await service\.rpc\('invitation_release'/);
    assert.match(fn('invitation_release'), /where i\.id = p_invitation and i\.status = 'accepted'\s+and i\.accepted_at > now\(\) - interval '5 minutes'\s+and public\._invitation_account_pending/);
  });
});

describe('INV-08/09/10 iptal, tekrar gönderim, eski token', () => {
  test('iptal yalnızca bekleyen daveti değiştirir; satır yoksa P0002 (kabul edilmiş iptal edilemez); hesap silinmez', () => {
    const revoke = fn('platform_revoke_owner_invitation');
    assert.match(revoke, /set status = 'revoked', revoked_at = now\(\)\s+where i\.organization_id = p_org and i\.status = 'pending'/);
    assert.match(revoke, /raise exception 'not_found' using errcode = 'P0002'/);
    assert.doesNotMatch(revoke, /delete|auth\.users/);
  });
  test('tekrar gönderim: bekleyen satırın özeti ve süresi yenilenir (eski özet kalmaz); kabul edilmişte reddedilir', () => {
    const send = fn('platform_send_owner_invitation');
    assert.match(send, /set token_hash = p_token_hash, expires_at = now\(\) \+ public\.invitation_ttl\(\)/);
    assert.match(send, /raise exception 'invitation_accepted'/);
    assert.doesNotMatch(SQL, /previous_token|old_token|token_history/);
    // Her gönderim yeni token: sunucu her çağrıda üretir
    assert.match(SERVICE, /const \{ token, hash \} = createInvitationToken\(\);\s+const \{ data, error \} = await session\.supabase\.rpc\('platform_send_owner_invitation'/);
  });
});

describe('INV-11/12/13 e-posta, kiracı ve rol bağı', () => {
  test('e-posta bağı ve hesap durumu: e-posta eşleşmeli, hesap etkinleştirilmemiş, engellenmemiş olmalı', () => {
    const pending = fn('_invitation_account_pending');
    assert.match(pending, /and lower\(u\.email\) = p_email/);
    assert.match(pending, /and u\.email_confirmed_at is null\s+and u\.last_sign_in_at is null/);
    assert.match(pending, /and \(u\.banned_until is null or u\.banned_until < now\(\)\)/);
    assert.match(fn('_invitation_usable'), /and public\._invitation_account_pending\(i\.user_id, i\.email\)/);
    // Oturum davetin e-postasıyla açılır (formdan e-posta alınmaz)
    assert.match(ACTIVATE, /signInWithPassword\(\{ email: claim\.email, password: parsed\.data \}\)/);
    assert.doesNotMatch(strip(ACTIVATE), /formData\.get\('email'\)/);
  });
  test('kiracı bağı: aktif ofis çerezi davetin organizasyonu; istemciden organizasyon alınmaz', () => {
    const code = strip(ACTIVATE);
    assert.match(code, /\.set\(ACTIVE_ORG_COOKIE, claim\.organization_id,/);
    assert.doesNotMatch(code, /formData\.get\('(organization|org|organization_id|organizationId|role|next|redirect)/);
    const keys = [...code.matchAll(/formData\.get\('([a-z_]+)'\)/g)].map((m) => m[1]).sort();
    assert.deepEqual(keys, ['confirm', 'password', 'token']);
    // Platform tarafı: e-posta / kullanıcı / rol istemciden alınmaz
    assert.match(read('src/app/actions/platform.ts'), /export async function sendOwnerInvitationAction\(orgId: string\)/);
    assert.match(fn('platform_send_owner_invitation'), /from public\.organization_members m join auth\.users u on u\.id = m\.user_id\s+where m\.organization_id = p_org and m\.role = 'owner' and m\.status = 'active'/);
  });
  test('rol bağı: davet yalnızca owner; kullanım için üyelik rolü = davet rolü ve üyelik aktif', () => {
    assert.match(SQL, /role public\.org_role not null default 'owner' check \(role = 'owner'\)/);
    assert.match(fn('_invitation_usable'), /and m\.status = 'active' and m\.role = i\.role/);
    assert.doesNotMatch(strip(ACTIVATE), /is_super_admin|organization_members|\.insert\(/);
  });
});

describe('INV-14 geçersiz token biçimi ve aynı yanıt', () => {
  test('biçim denetimi', () => {
    const { token } = createInvitationToken();
    assert.equal(isInvitationTokenFormat(token), true);
    for (const bad of [null, undefined, 42, '', token.slice(1), `${token}a`, token.replace(/.$/, '='), `${token.slice(0, 42)}/`, '../../etc/passwd', `${'a'.repeat(43)} `]) assert.equal(isInvitationTokenFormat(bad), false, String(bad));
  });
  test('aktivasyonda biçimsiz token veritabanına gitmeden aynı "geçersiz" mesajını alır', () => {
    assert.match(ACTIVATE, /if \(!isInvitationTokenFormat\(token\)\) return \{ ok: false, error: INVALID \};/);
    assert.match(ACTIVATE, /if \(!isInvitationTokenFormat\(token\)\) return \{ error: INVALID, invalid: true \};/);
    assert.doesNotMatch(ACTIVATE, /süresi doldu'|iptal edildi'|kullanıldı'/);
  });
});

describe('INV-15/16 yetki ve kiracı izolasyonu', () => {
  test('platform işlemleri: sunucu işleminde requireSuperAdmin, veritabanında assert_super_admin', () => {
    const actions = read('src/app/actions/platform.ts');
    for (const name of ['sendOwnerInvitationAction', 'revokeOwnerInvitationAction']) {
      const body = actions.slice(actions.indexOf(`export async function ${name}`), actions.indexOf('\n}\n', actions.indexOf(`export async function ${name}`)));
      assert.match(body, /const session = await requireSuperAdmin\(\);/, name);
    }
    for (const name of ['platform_create_organization', 'platform_send_owner_invitation', 'platform_mark_invitation_sent', 'platform_revoke_owner_invitation', 'platform_owner_invitation']) {
      assert.match(fn(name), /begin\s+perform public\.assert_super_admin\(\);/, name);
    }
  });
  test('token fonksiyonları istemciye kapalı (yalnızca service_role); yardımcılar dışarı açık değil', () => {
    for (const name of ['invitation_lookup(text, text)', 'invitation_accept(text, text)', 'invitation_release(uuid)']) {
      assert.ok(SQL.includes(`revoke all on function public.${name} from public, anon, authenticated;`), name);
      assert.ok(SQL.includes(`grant execute on function public.${name} to service_role;`), name);
    }
    for (const name of ['_invitation_account_pending(uuid, text)', '_invitation_attempt_blocked(text)', '_invitation_log_failure(text)', '_invitation_usable(text)']) {
      assert.ok(SQL.includes(`revoke all on function public.${name} from public, anon, authenticated;`), name);
    }
    assert.match(ACTIVATE, /const service = createServiceClient\(\);/);
  });
  test('tablo: RLS açık, yalnızca SELECT politikası (süper admin / users.manage), token_hash sütun yetkisi yok', () => {
    assert.match(SQL, /alter table public\.organization_invitations enable row level security;/);
    assert.match(SQL, /revoke all on public\.organization_invitations from public, anon, authenticated;/);
    const grant = /grant select \(([^)]+)\)\s+on public\.organization_invitations to authenticated;/.exec(SQL);
    assert.ok(grant);
    assert.doesNotMatch(grant[1], /token_hash/);
    assert.match(SQL, /for select to authenticated\s+using \(public\.is_super_admin\(\) or public\.has_org_permission\(organization_id, 'users\.manage'\)\);/);
    assert.doesNotMatch(SQL, /create policy[^;]+for (insert|update|delete|all)/);
  });
});

describe('INV-17 açık yönlendirme', () => {
  test('aktivasyon yalnızca sabit iç adreslere yönlendirir; istemci yönlendirme parametresi okunmaz', () => {
    const code = strip(ACTIVATE);
    const targets = [...code.matchAll(/redirect\(([^)]*)\)/g)].map((m) => m[1]);
    assert.deepEqual(targets.sort(), ["'/admin'", "'/admin/giris'"]);
    assert.doesNotMatch(code, /searchParams|safeNext|headers\(\)\.get\('referer'\)/);
    // Bağlantı da sabit yol + parça; sayfa sorgu parametresi okumaz
    assert.equal(ACTIVATION_PATH, '/admin/davet');
    assert.doesNotMatch(read('src/app/admin/davet/page.tsx'), /searchParams/);
  });
});

describe('INV-18 mevcut kullanıcı uyumluluğu', () => {
  test('mevcut hesap sahip olarak eklenir: şifresine / durumuna dokunulmaz, davet açılmaz', () => {
    const code = strip(PROVISION);
    assert.match(code, /let createdUser = false;\s+if \(!ownerId\) \{/);
    assert.doesNotMatch(code, /updateUserById|resetPassword|ban_duration/);
    assert.match(code, /ownerAccount: createdUser \? 'invitation_pending' : 'existing_account'/);
  });
  test('migration mevcut kullanıcı / üyelik / şifre verisini değiştirmez; eski 5 parametreli çağrı çalışır', () => {
    assert.doesNotMatch(SQL, /update auth\.users|delete from auth\.users|update public\.organization_members|delete from public\.organization_members|update public\.profiles/);
    assert.match(SQL, /p_owner uuid, p_invite_token_hash text default null/);
  });
  test('giriş ve şifre sıfırlama ayrı ve aynen çalışır; şifre kuralı ortak', () => {
    const auth = read('src/app/actions/auth.ts');
    assert.match(auth, /supabase\.auth\.signInWithPassword\(parsed\.data\)/);
    assert.match(auth, /supabase\.auth\.resetPasswordForEmail\(parsed\.data, \{/);
    assert.match(read('src/app/admin/auth/callback/route.ts'), /const OTP_TYPES: EmailOtpType\[\] = \['recovery'/);
    assert.match(auth, /import \{ authPasswordErrorMessage, passwordSchema \} from '@\/platform\/auth\/password-policy';/);
    assert.match(ACTIVATE, /const parsed = passwordSchema\.safeParse\(password\);/);
    // Davet tokenı şifre sıfırlama tokenı olarak kullanılmaz (Supabase OTP'si ayrı)
    assert.doesNotMatch(strip(ACTIVATE), /verifyOtp|resetPasswordForEmail|exchangeCodeForSession/);
  });
});

describe('INV-19 gizlilik', () => {
  test('bağlantı tokenı URL parçasında (#) taşır; e-posta konusu token / bağlantı içermez, gövde HTML kaçışlı', () => {
    const { token } = createInvitationToken();
    const link = invitationLink('https://ofis.example.com/', token);
    assert.equal(link, `https://ofis.example.com/admin/davet#t=${token}`);
    assert.equal(new URL(link).search, '');
    const mail = buildInvitationEmail({ organizationName: 'Örnek <Ofis>', link, expiresAt: '2026-10-07T10:00:00Z' });
    assert.ok(!mail.subject.includes(token) && !mail.subject.includes('http'));
    assert.ok(mail.text.includes(link) && mail.html.includes(link));
    assert.ok(mail.html.includes('Örnek &lt;Ofis&gt;') && !mail.html.includes('<Ofis>'));
    assert.doesNotMatch(mail.text, /geçici şifre|şifreniz:|password/i);
  });
  test('token / bağlantı loglanmaz; hata loglarında yalnızca güvenli tanımlayıcılar', () => {
    for (const p of ['src/modules/platform/invitations/service.ts', 'src/app/actions/invitation.ts', 'src/modules/platform/invitations/token.ts', 'src/components/panel/activation-form.tsx']) {
      const logs = [...read(p).matchAll(/console\.\w+\(([^;]*)\);/g)].map((m) => m[1]);
      for (const l of logs) assert.doesNotMatch(l, /\btoken\b|\blink\b|\bhash\b|row\.email|message|password/i, `${p}: ${l}`);
    }
    assert.match(SERVICE, /console\.error\('\[invitation\] email failed', \{ invitation: row\.invitation_id, org: orgId, provider: sent\.provider, error: sent\.error \}\)/);
    // İstemci tokenı okuyunca adres çubuğundan siler
    assert.match(read('src/components/panel/activation-form.tsx'), /window\.history\.replaceState\(null, '', window\.location\.pathname\)/);
    // Başarısız deneme kaydı tokenı / özeti yazmaz
    assert.match(fn('_invitation_log_failure'), /values \(null, 'invitation\.activation_failed', '\{\}'::jsonb, left\(p_ip_hash, 128\)\)/);
  });
});

describe('INV-20 e-posta yapılandırması ve hata yolları', () => {
  test('e-posta yapılandırılmamışsa token üretilmeden / davet yenilenmeden durur; gönderim hatasında davet bekler', () => {
    const body = SERVICE.slice(SERVICE.indexOf('export async function sendOwnerInvitation'));
    const configAt = body.indexOf('if (!isEmailConfigured())');
    const tokenAt = body.indexOf('createInvitationToken()');
    const rpcAt = body.indexOf("rpc('platform_send_owner_invitation'");
    const sendAt = body.indexOf('await sendEmail(');
    const markAt = body.indexOf("rpc('platform_mark_invitation_sent'");
    assert.ok(configAt > 0 && configAt < tokenAt && tokenAt < rpcAt && rpcAt < sendAt && sendAt < markAt, 'sıra: yapılandırma → token → yenileme → e-posta → gönderildi işareti');
    assert.match(body, /if \(!sent\.ok\) \{[\s\S]*throw new ActionError\('Davet e-postası gönderilemedi\. Davet bekliyor/);
    // Teslim ile kabul ayrı: gönderildi işareti yalnızca last_sent_at
    assert.match(fn('platform_mark_invitation_sent'), /update public\.organization_invitations set last_sent_at = now\(\) where id = p_invitation and status = 'pending';/);
  });
  test('iptal: bekleyen davet yoksa anlaşılır hata (P0002 → not_found)', () => {
    assert.match(SERVICE, /if \(error\?\.code === 'P0002'\) throw new ActionError\('İptal edilecek bekleyen davet yok\.', 'not_found'\);/);
  });
});

describe('INV-21 performans: ziyaretçi sitesi davet kodunu yüklemez', () => {
  test('kiracı sitesi / site bileşenleri davet modülünü ve aktivasyon formunu içe aktarmaz', () => {
    const files = [...walk('src/app/t'), ...walk('src/components/site'), ...walk('src/site-config'), ...walk('src/theme-engine')];
    for (const p of files) assert.doesNotMatch(read(p), /invitations\/|activation-form|actions\/invitation/, p);
    assert.match(read('src/proxy.ts'), /'\/admin\/davet'/);
  });
});
