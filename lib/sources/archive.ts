import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate, isDomain } from '@/lib/utils'

interface ArchiveSearchResponse {
  response?: {
    docs?: Array<{
      identifier: string
      title: string
      description?: string | string[]
      creator?: string | string[]
      date?: string
      mediatype: string
      downloads?: number
    }>
  }
}

interface WaybackResponse {
  archived_snapshots?: {
    closest?: {
      url: string
      timestamp: string
      status: string
    }
  }
}

export const archiveAdapter: SourceAdapter = {
  config: {
    name: 'Internet Archive',
    source: 'archive',
    category: 'web',
    enabled: true,
    timeout: 4000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      // Check if it's a domain query for Wayback Machine
      if (isDomain(query)) {
        const waybackResults = await searchWayback(query)
        if (waybackResults.length > 0) {
          return waybackResults
        }
      }

      // Search the Internet Archive's collection
      const url = buildUrl('https://archive.org/advancedsearch.php', {
        q: query,
        output: 'json',
        rows: limit,
        fl: 'identifier,title,description,creator,date,mediatype,downloads',
        sort: 'downloads desc',
      })

      const data = await fetchWithTimeout<ArchiveSearchResponse>(url, {
        timeout: this.config.timeout,
      })

      if (!data.response?.docs) {
        return []
      }

      return data.response.docs.map(item => {
        const description = Array.isArray(item.description)
          ? item.description[0]
          : item.description

        const creator = Array.isArray(item.creator)
          ? item.creator[0]
          : item.creator

        return {
          id: generateId(),
          title: item.title || item.identifier,
          description: truncate(
            [
              description?.slice(0, 200),
              creator ? `by ${creator}` : null,
              item.mediatype ? `Type: ${item.mediatype}` : null,
              item.downloads ? `${item.downloads.toLocaleString()} downloads` : null,
            ].filter(Boolean).join(' | '),
            300
          ),
          url: `https://archive.org/details/${item.identifier}`,
          source: 'archive' as const,
          category: 'web' as const,
          timestamp: item.date,
          score: Math.min(1, 0.5 + ((item.downloads || 0) / 100000)),
          metadata: {
            identifier: item.identifier,
            mediatype: item.mediatype,
            downloads: item.downloads,
            creator,
          },
          favicon: 'https://archive.org/favicon.ico',
        }
      })
    } catch (error) {
      console.error('Internet Archive search error:', error)
      return []
    }
  },
}

/**
 * Search Wayback Machine for archived URLs
 */
async function searchWayback(domain: string): Promise<SearchResult[]> {
  try {
    const url = buildUrl('https://archive.org/wayback/available', {
      url: domain,
    })

    const data = await fetchWithTimeout<WaybackResponse>(url, {
      timeout: 3000,
    })

    const snapshot = data.archived_snapshots?.closest
    if (!snapshot) {
      return []
    }

    const timestamp = snapshot.timestamp
    const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`

    return [{
      id: generateId(),
      title: `Wayback Machine: ${domain}`,
      description: `Archived snapshot from ${date}`,
      url: snapshot.url,
      source: 'archive' as const,
      category: 'osint' as const,
      timestamp: date,
      score: 0.8,
      metadata: {
        originalUrl: `https://${domain}`,
        archiveTimestamp: timestamp,
        status: snapshot.status,
      },
      favicon: 'https://archive.org/favicon.ico',
    }]
  } catch {
    return []
  }
}

/**
 * Get all snapshots for a URL from Wayback Machine
 */
export async function getWaybackSnapshots(urlToSearch: string, limit = 20): Promise<SearchResult[]> {
  try {
    const cdxUrl = buildUrl('https://web.archive.org/cdx/search/cdx', {
      url: urlToSearch,
      output: 'json',
      limit,
      fl: 'timestamp,original,statuscode',
      collapse: 'timestamp:8', // One per day
    })

    const data = await fetchWithTimeout<string[][]>(cdxUrl, { timeout: 4000 })

    // First row is headers
    if (!data || data.length < 2) return []

    return data.slice(1).map(([timestamp, original, status]) => {
      const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`

      return {
        id: generateId(),
        title: `${original} (${date})`,
        description: `HTTP ${status} | Archived on ${date}`,
        url: `https://web.archive.org/web/${timestamp}/${original}`,
        source: 'archive' as const,
        category: 'osint' as const,
        timestamp: date,
        score: 0.7,
        metadata: {
          archiveTimestamp: timestamp,
          originalUrl: original,
          httpStatus: status,
        },
      }
    })
  } catch {
    return []
  }
}
