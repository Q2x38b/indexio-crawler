import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate, isDomain } from '@/lib/utils'

interface WhoisData {
  domainName?: string
  registrar?: string
  createdDate?: string
  updatedDate?: string
  expiresDate?: string
  registrant?: {
    organization?: string
    country?: string
  }
  nameServers?: string[]
  status?: string[]
}

interface RdapResponse {
  ldhName?: string
  handle?: string
  events?: Array<{
    eventAction: string
    eventDate: string
  }>
  entities?: Array<{
    roles?: string[]
    vcardArray?: [string, Array<[string, Record<string, string>, string, string]>]
  }>
  nameservers?: Array<{
    ldhName: string
  }>
  status?: string[]
}

export const whoisAdapter: SourceAdapter = {
  config: {
    name: 'WHOIS',
    source: 'whois',
    category: 'osint',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    // Only search for domain-like queries
    if (!isDomain(query)) {
      return []
    }

    try {
      const whoisData = await lookupDomain(query)

      if (!whoisData) {
        return []
      }

      const result: SearchResult = {
        id: generateId(),
        title: `WHOIS: ${query}`,
        description: truncate(
          [
            whoisData.registrar ? `Registrar: ${whoisData.registrar}` : null,
            whoisData.createdDate ? `Created: ${new Date(whoisData.createdDate).toLocaleDateString()}` : null,
            whoisData.expiresDate ? `Expires: ${new Date(whoisData.expiresDate).toLocaleDateString()}` : null,
            whoisData.registrant?.organization ? `Org: ${whoisData.registrant.organization}` : null,
            whoisData.nameServers?.length ? `NS: ${whoisData.nameServers.slice(0, 2).join(', ')}` : null,
          ].filter(Boolean).join(' | '),
          300
        ),
        url: `https://who.is/whois/${query}`,
        source: 'whois' as const,
        category: 'osint' as const,
        timestamp: whoisData.updatedDate || whoisData.createdDate,
        score: 0.85,
        metadata: whoisData,
        favicon: 'https://who.is/favicon.ico',
      }

      return [result]
    } catch (error) {
      console.error('WHOIS lookup error:', error)
      return []
    }
  },
}

/**
 * Lookup domain using RDAP (modern WHOIS replacement)
 */
async function lookupDomain(domain: string): Promise<WhoisData | null> {
  try {
    // Try RDAP first (more reliable, no rate limits typically)
    const tld = domain.split('.').pop()?.toLowerCase()

    // RDAP bootstrap for common TLDs
    const rdapServers: Record<string, string> = {
      com: 'https://rdap.verisign.com/com/v1/domain/',
      net: 'https://rdap.verisign.com/net/v1/domain/',
      org: 'https://rdap.publicinterestregistry.org/rdap/domain/',
      io: 'https://rdap.nic.io/domain/',
      dev: 'https://rdap.nic.google/rdap/domain/',
      app: 'https://rdap.nic.google/rdap/domain/',
    }

    const rdapBase = rdapServers[tld || ''] || 'https://rdap.org/domain/'
    const rdapUrl = `${rdapBase}${domain}`

    const data = await fetchWithTimeout<RdapResponse>(rdapUrl, {
      timeout: 4000,
      headers: { 'Accept': 'application/rdap+json' },
    })

    return parseRdapResponse(data)
  } catch {
    return null
  }
}

/**
 * Parse RDAP response into WhoisData
 */
function parseRdapResponse(data: RdapResponse): WhoisData | null {
  if (!data.ldhName) return null

  const events = data.events || []
  const createdEvent = events.find(e => e.eventAction === 'registration')
  const updatedEvent = events.find(e => e.eventAction === 'last changed')
  const expiresEvent = events.find(e => e.eventAction === 'expiration')

  // Extract registrar from entities
  const registrarEntity = data.entities?.find(e => e.roles?.includes('registrar'))
  let registrar: string | undefined

  if (registrarEntity?.vcardArray?.[1]) {
    const fnEntry = registrarEntity.vcardArray[1].find(
      (entry): entry is [string, Record<string, string>, string, string] =>
        Array.isArray(entry) && entry[0] === 'fn'
    )
    if (fnEntry) {
      registrar = fnEntry[3]
    }
  }

  return {
    domainName: data.ldhName,
    registrar,
    createdDate: createdEvent?.eventDate,
    updatedDate: updatedEvent?.eventDate,
    expiresDate: expiresEvent?.eventDate,
    nameServers: data.nameservers?.map(ns => ns.ldhName),
    status: data.status,
  }
}

/**
 * Get DNS records for a domain
 */
export async function getDnsRecords(domain: string): Promise<SearchResult[]> {
  try {
    // Use DNS over HTTPS (Cloudflare)
    const types = ['A', 'AAAA', 'MX', 'TXT', 'NS']
    const results: SearchResult[] = []

    for (const type of types) {
      try {
        const url = `https://cloudflare-dns.com/dns-query?name=${domain}&type=${type}`
        const data = await fetchWithTimeout<{
          Answer?: Array<{ type: number; data: string; TTL: number }>
        }>(url, {
          timeout: 2000,
          headers: { 'Accept': 'application/dns-json' },
        })

        if (data.Answer?.length) {
          results.push({
            id: generateId(),
            title: `DNS ${type}: ${domain}`,
            description: data.Answer.map(a => a.data).slice(0, 5).join(', '),
            url: `https://dnschecker.org/#${type}/${domain}`,
            source: 'dns' as const,
            category: 'osint' as const,
            score: 0.7,
            metadata: {
              type,
              records: data.Answer,
            },
          })
        }
      } catch {
        // Continue with other record types
      }
    }

    return results
  } catch {
    return []
  }
}
