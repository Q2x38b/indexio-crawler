import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface IPAPIResponse {
  query: string
  status: string
  country: string
  countryCode: string
  region: string
  regionName: string
  city: string
  zip: string
  lat: number
  lon: number
  timezone: string
  isp: string
  org: string
  as: string
  mobile: boolean
  proxy: boolean
  hosting: boolean
}

interface AbuseIPDBResponse {
  data: {
    ipAddress: string
    isPublic: boolean
    ipVersion: number
    isWhitelisted: boolean
    abuseConfidenceScore: number
    countryCode: string
    usageType: string
    isp: string
    domain: string
    totalReports: number
    numDistinctUsers: number
    lastReportedAt: string | null
  }
}

// IP address regex
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
const IPV6_REGEX = /^(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}$/i

export const ipgeoAdapter: SourceAdapter = {
  config: {
    name: 'IP Lookup',
    source: 'ipgeo',
    category: 'osint',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 5): Promise<SearchResult[]> {
    const ip = query.trim()

    // Validate IP address
    if (!IP_REGEX.test(ip) && !IPV6_REGEX.test(ip)) {
      return []
    }

    const results: SearchResult[] = []

    try {
      // Primary: ip-api.com (free, no key required)
      const geoData = await getIPGeolocation(ip)
      if (geoData) {
        results.push(geoData)
      }

      // Secondary: Check reputation (if API key available)
      const abuseData = await checkAbuseIPDB(ip)
      if (abuseData) {
        results.push(abuseData)
      }

      // Add useful lookup links
      results.push({
        id: generateId(),
        title: `Shodan: ${ip}`,
        description: 'View open ports, services, and vulnerabilities for this IP on Shodan.',
        url: `https://www.shodan.io/host/${ip}`,
        source: 'ipgeo' as const,
        category: 'osint' as const,
        score: 0.7,
        metadata: { type: 'shodan_link' },
        favicon: 'https://www.shodan.io/favicon.ico',
      })

      results.push({
        id: generateId(),
        title: `VirusTotal: ${ip}`,
        description: 'Check IP reputation and associated malware on VirusTotal.',
        url: `https://www.virustotal.com/gui/ip-address/${ip}`,
        source: 'ipgeo' as const,
        category: 'osint' as const,
        score: 0.7,
        metadata: { type: 'virustotal_link' },
        favicon: 'https://www.virustotal.com/favicon.ico',
      })

      results.push({
        id: generateId(),
        title: `Censys: ${ip}`,
        description: 'View detailed host information and certificates on Censys.',
        url: `https://search.censys.io/hosts/${ip}`,
        source: 'ipgeo' as const,
        category: 'osint' as const,
        score: 0.65,
        metadata: { type: 'censys_link' },
        favicon: 'https://censys.io/favicon.ico',
      })

    } catch (error) {
      console.error('IP lookup error:', error)
    }

    return results.slice(0, limit)
  },
}

async function getIPGeolocation(ip: string): Promise<SearchResult | null> {
  try {
    // Note: ip-api.com free tier only works with HTTP, but we try HTTPS first for Vercel edge
    const url = `https://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,mobile,proxy,hosting,query`
    const data = await fetchWithTimeout<IPAPIResponse>(url, {
      timeout: 3000,
    })

    if (data.status !== 'success') return null

    const flags: string[] = []
    if (data.mobile) flags.push('Mobile')
    if (data.proxy) flags.push('Proxy/VPN')
    if (data.hosting) flags.push('Hosting/DC')

    return {
      id: generateId(),
      title: `IP Geolocation: ${ip}`,
      description: truncate(
        [
          `${data.city}, ${data.regionName}, ${data.country}`,
          `ISP: ${data.isp}`,
          data.org !== data.isp ? `Org: ${data.org}` : null,
          flags.length ? `Flags: ${flags.join(', ')}` : null,
        ].filter(Boolean).join(' | '),
        300
      ),
      url: `https://www.google.com/maps/@${data.lat},${data.lon},12z`,
      source: 'ipgeo' as const,
      category: 'osint' as const,
      score: 0.9,
      metadata: {
        ip: data.query,
        country: data.country,
        countryCode: data.countryCode,
        region: data.regionName,
        city: data.city,
        zip: data.zip,
        lat: data.lat,
        lon: data.lon,
        timezone: data.timezone,
        isp: data.isp,
        org: data.org,
        asn: data.as,
        isMobile: data.mobile,
        isProxy: data.proxy,
        isHosting: data.hosting,
      },
      favicon: 'https://ip-api.com/favicon.ico',
    }
  } catch {
    return null
  }
}

async function checkAbuseIPDB(ip: string): Promise<SearchResult | null> {
  const apiKey = process.env.ABUSEIPDB_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}`
    const data = await fetchWithTimeout<AbuseIPDBResponse>(url, {
      timeout: 3000,
      headers: {
        'Key': apiKey,
        'Accept': 'application/json',
      },
    })

    if (!data.data) return null

    const d = data.data
    const riskLevel = d.abuseConfidenceScore >= 75 ? 'HIGH' :
                      d.abuseConfidenceScore >= 25 ? 'MEDIUM' : 'LOW'

    return {
      id: generateId(),
      title: `AbuseIPDB: ${ip} - ${riskLevel} Risk`,
      description: truncate(
        [
          `Abuse Score: ${d.abuseConfidenceScore}%`,
          `Reports: ${d.totalReports} from ${d.numDistinctUsers} users`,
          d.usageType ? `Type: ${d.usageType}` : null,
          d.domain ? `Domain: ${d.domain}` : null,
          d.lastReportedAt ? `Last reported: ${new Date(d.lastReportedAt).toLocaleDateString()}` : null,
        ].filter(Boolean).join(' | '),
        300
      ),
      url: `https://www.abuseipdb.com/check/${ip}`,
      source: 'ipgeo' as const,
      category: 'osint' as const,
      score: 0.85,
      metadata: {
        ip: d.ipAddress,
        abuseScore: d.abuseConfidenceScore,
        riskLevel,
        totalReports: d.totalReports,
        usageType: d.usageType,
        isp: d.isp,
        domain: d.domain,
      },
      favicon: 'https://www.abuseipdb.com/favicon.ico',
    }
  } catch {
    return null
  }
}
