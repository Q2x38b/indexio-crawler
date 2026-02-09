import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface CVEItem {
  cve: {
    id: string
    descriptions: Array<{
      lang: string
      value: string
    }>
    published: string
    lastModified: string
    metrics?: {
      cvssMetricV31?: Array<{
        cvssData: {
          baseScore: number
          baseSeverity: string
        }
      }>
      cvssMetricV2?: Array<{
        cvssData: {
          baseScore: number
        }
      }>
    }
    references?: Array<{
      url: string
      source: string
    }>
  }
}

interface NVDResponse {
  vulnerabilities?: CVEItem[]
  totalResults?: number
}

export const cveAdapter: SourceAdapter = {
  config: {
    name: 'CVE Database',
    source: 'cve',
    category: 'osint',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      // NVD API 2.0
      const url = buildUrl('https://services.nvd.nist.gov/rest/json/cves/2.0', {
        keywordSearch: query,
        resultsPerPage: limit,
      })

      const data = await fetchWithTimeout<NVDResponse>(url, {
        timeout: this.config.timeout,
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!data.vulnerabilities) {
        return []
      }

      return data.vulnerabilities.map(item => {
        const cve = item.cve
        const description = cve.descriptions.find(d => d.lang === 'en')?.value || ''

        // Get CVSS score
        let severity = 'UNKNOWN'
        let score = 0
        if (cve.metrics?.cvssMetricV31?.[0]) {
          score = cve.metrics.cvssMetricV31[0].cvssData.baseScore
          severity = cve.metrics.cvssMetricV31[0].cvssData.baseSeverity
        } else if (cve.metrics?.cvssMetricV2?.[0]) {
          score = cve.metrics.cvssMetricV2[0].cvssData.baseScore
          severity = score >= 7 ? 'HIGH' : score >= 4 ? 'MEDIUM' : 'LOW'
        }

        return {
          id: generateId(),
          title: cve.id,
          description: truncate(
            [
              description.slice(0, 200),
              `Severity: ${severity} (${score})`,
            ].join(' | '),
            300
          ),
          url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
          source: 'cve' as const,
          category: 'osint' as const,
          timestamp: cve.published,
          score: 0.7 + (score / 40), // Higher CVSS = higher relevance
          metadata: {
            cveId: cve.id,
            cvssScore: score,
            severity,
            references: cve.references?.slice(0, 5),
          },
          favicon: 'https://nvd.nist.gov/favicon.ico',
        }
      })
    } catch (error) {
      console.error('CVE search error:', error)
      // Fallback to CIRCL CVE API
      return searchCIRCL(query, limit)
    }
  },
}

/**
 * Fallback CIRCL CVE API
 */
async function searchCIRCL(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://cve.circl.lu/api/search/${encodeURIComponent(query)}`

    const data = await fetchWithTimeout<Array<{
      id: string
      summary: string
      Published: string
      cvss?: number
    }>>(url, { timeout: 4000 })

    if (!Array.isArray(data)) return []

    return data.slice(0, limit).map(item => ({
      id: generateId(),
      title: item.id,
      description: truncate(
        [
          item.summary,
          item.cvss ? `CVSS: ${item.cvss}` : null,
        ].filter(Boolean).join(' | '),
        300
      ),
      url: `https://cve.circl.lu/cve/${item.id}`,
      source: 'cve' as const,
      category: 'osint' as const,
      timestamp: item.Published,
      score: 0.7 + ((item.cvss || 0) / 40),
      favicon: 'https://cve.circl.lu/favicon.ico',
    }))
  } catch {
    return []
  }
}

/**
 * Get CVE by ID
 */
export async function getCVEById(cveId: string): Promise<SearchResult | null> {
  try {
    const url = `https://cve.circl.lu/api/cve/${cveId}`
    const data = await fetchWithTimeout<{
      id: string
      summary: string
      Published: string
      cvss?: number
      references?: string[]
    }>(url, { timeout: 3000 })

    if (!data.id) return null

    return {
      id: generateId(),
      title: data.id,
      description: truncate(data.summary, 300),
      url: `https://nvd.nist.gov/vuln/detail/${data.id}`,
      source: 'cve' as const,
      category: 'osint' as const,
      timestamp: data.Published,
      score: 0.9,
      metadata: {
        cvss: data.cvss,
        references: data.references,
      },
    }
  } catch {
    return null
  }
}
