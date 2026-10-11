import 'server-only';
import { createManualProvider, createVercelProvider, type DomainProvider } from '@/modules/domains/provider';

/** DOMAIN_PROVIDER=vercel ve kimlik bilgileri tanımlıysa Vercel API, aksi halde elle kurulum. */
export function getDomainProvider(): DomainProvider {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (process.env.DOMAIN_PROVIDER === 'vercel' && token && projectId) {
    return createVercelProvider({ token, projectId, teamId: process.env.VERCEL_TEAM_ID || undefined });
  }
  return createManualProvider();
}

export { vercelDnsRecords, type DnsRecord, type DomainStatus } from '@/modules/domains/provider';
