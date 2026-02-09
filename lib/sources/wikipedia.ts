import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, stripHtml, truncate } from '@/lib/utils'

interface WikipediaSearchResponse {
  query?: {
    search?: Array<{
      pageid: number
      title: string
      snippet: string
      timestamp: string
    }>
  }
}

interface WikipediaExtractResponse {
  query?: {
    pages?: Record<string, {
      pageid: number
      title: string
      extract?: string
    }>
  }
}

export const wikipediaAdapter: SourceAdapter = {
  config: {
    name: 'Wikipedia',
    source: 'wikipedia',
    category: 'web',
    enabled: true,
    timeout: 3000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const url = buildUrl('https://en.wikipedia.org/w/api.php', {
        action: 'query',
        list: 'search',
        srsearch: query,
        srlimit: limit,
        format: 'json',
        origin: '*',
      })

      const data = await fetchWithTimeout<WikipediaSearchResponse>(url, {
        timeout: this.config.timeout,
      })

      if (!data.query?.search) {
        return []
      }

      return data.query.search.map(item => ({
        id: generateId(),
        title: item.title,
        description: truncate(stripHtml(item.snippet), 300),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        source: 'wikipedia' as const,
        category: 'web' as const,
        timestamp: item.timestamp,
        score: 0.8,
        favicon: 'https://en.wikipedia.org/favicon.ico',
      }))
    } catch (error) {
      console.error('Wikipedia search error:', error)
      return []
    }
  },
}

/**
 * Get Wikipedia article extract for instant answers
 */
export async function getWikipediaExtract(title: string): Promise<string | null> {
  try {
    const url = buildUrl('https://en.wikipedia.org/w/api.php', {
      action: 'query',
      titles: title,
      prop: 'extracts',
      exintro: 1,
      explaintext: 1,
      format: 'json',
      origin: '*',
    })

    const data = await fetchWithTimeout<WikipediaExtractResponse>(url, { timeout: 2000 })
    const pages = data.query?.pages

    if (!pages) return null

    const page = Object.values(pages)[0]
    return page?.extract || null
  } catch {
    return null
  }
}
