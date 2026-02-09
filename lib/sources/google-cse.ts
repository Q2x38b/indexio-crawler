import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface GoogleCSEResult {
  items?: Array<{
    title: string
    link: string
    snippet: string
    displayLink: string
    pagemap?: {
      metatags?: Array<Record<string, string>>
      cse_image?: Array<{ src: string }>
    }
  }>
  searchInformation?: {
    totalResults: string
    searchTime: number
  }
}

const CSE_ID = '20e0bdcc4fe9a4599'

export const googleCSEAdapter: SourceAdapter = {
  config: {
    name: 'Google CSE',
    source: 'googlecse',
    category: 'web',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      // Fallback to scraping approach if no API key
      return searchWithoutAPI(query, limit)
    }

    try {
      const url = new URL('https://www.googleapis.com/customsearch/v1')
      url.searchParams.set('key', apiKey)
      url.searchParams.set('cx', CSE_ID)
      url.searchParams.set('q', query)
      url.searchParams.set('num', String(Math.min(limit, 10)))

      const data = await fetchWithTimeout<GoogleCSEResult>(url.toString(), {
        timeout: 5000,
      })

      if (!data.items?.length) {
        return []
      }

      return data.items.map((item) => ({
        id: generateId(),
        title: item.title,
        description: truncate(item.snippet || '', 300),
        url: item.link,
        source: 'googlecse' as const,
        category: 'web' as const,
        score: 0.95,
        metadata: {
          displayLink: item.displayLink,
          totalResults: data.searchInformation?.totalResults,
          searchTime: data.searchInformation?.searchTime,
        },
        favicon: `https://www.google.com/s2/favicons?domain=${item.displayLink}&sz=32`,
      }))
    } catch (error) {
      console.error('Google CSE error:', error)
      return searchWithoutAPI(query, limit)
    }
  },
}

// Fallback search using DuckDuckGo or direct scraping
async function searchWithoutAPI(query: string, limit: number): Promise<SearchResult[]> {
  try {
    // Use DuckDuckGo HTML as fallback
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IndexioBot/1.0)',
      },
    })

    const html = await response.text()
    const results: SearchResult[] = []

    // Parse results from HTML
    const resultMatches = html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi)
    const snippetMatches = html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/gi)

    const urls = [...resultMatches]
    const snippets = [...snippetMatches]

    for (let i = 0; i < Math.min(urls.length, limit); i++) {
      const urlMatch = urls[i]
      const snippetMatch = snippets[i]

      if (urlMatch) {
        const link = urlMatch[1]
        const title = urlMatch[2]
        const snippet = snippetMatch?.[1] || ''

        // Decode DuckDuckGo redirect URL
        const actualUrl = decodeURIComponent(link.replace(/.*uddg=([^&]*).*/, '$1'))

        results.push({
          id: generateId(),
          title: title.trim(),
          description: truncate(snippet.trim(), 300),
          url: actualUrl,
          source: 'googlecse' as const,
          category: 'web' as const,
          score: 0.85 - (i * 0.02),
        })
      }
    }

    return results
  } catch (error) {
    console.error('Fallback search error:', error)
    return []
  }
}
