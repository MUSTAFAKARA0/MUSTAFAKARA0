import { DomainManager } from '@/components/domains/domain-manager';
import {
  addDomain,
  connectDomainAction,
  connectDomainManualAction,
  removeDomainAction,
  rotateDomainVerificationAction,
  setPrimaryDomainAction,
  verifyDomainAction,
} from '@/app/actions/platform';
import { listDomains } from '@/modules/domains/service';
import type { SessionUser } from '@/platform/auth/session';

/** KARAY konsolu: bir ofisin özel alan adları (Web Siteleri › Alan adı ve Organizasyon sayfası) */
export async function PlatformDomainsPanel({ session, orgId, fallbackUrl }: { session: SessionUser; orgId: string; fallbackUrl: string | null }) {
  const domains = await listDomains({ userId: session.user.id, platform: true }, orgId);
  return (
    <DomainManager
      domains={domains}
      fallbackUrl={fallbackUrl}
      actions={{
        add: addDomain.bind(null, orgId),
        verify: verifyDomainAction.bind(null, orgId),
        connect: connectDomainAction.bind(null, orgId),
        connectManual: connectDomainManualAction.bind(null, orgId),
        rotate: rotateDomainVerificationAction.bind(null, orgId),
        primary: setPrimaryDomainAction.bind(null, orgId),
        remove: removeDomainAction.bind(null, orgId),
      }}
    />
  );
}
