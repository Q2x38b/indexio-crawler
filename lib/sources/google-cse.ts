import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate, stripHtml } from '@/lib/utils'

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
        return searchWithoutAPI(query, limit)
      }

      return data.items.map((item, index) => ({
        id: generateId(),
        title: item.title,
        description: truncate(item.snippet || '', 300),
        url: item.link,
        source: 'googlecse' as const,
        category: 'web' as const,
        score: 0.95 - (index * 0.02),
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

/**
 * Fallback search using DuckDuckGo HTML
 */
async function searchWithoutAPI(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })

    if (!response.ok) {
      return []
    }

    const html = await response.text()
    const results: SearchResult[] = []

    // Strategy 1: Look for result__a links with uddg parameter
    const linkPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
    const snippetPattern = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi

    const links = [...html.matchAll(linkPattern)]
    const snippets = [...html.matchAll(snippetPattern)]

    for (let i = 0; i < Math.min(links.length, limit); i++) {
      const link = links[i]
      const rawUrl = link[1]
      const rawTitle = link[2]

      if (!rawUrl || !rawTitle) continue

      // Decode DuckDuckGo redirect URL
      let actualUrl = rawUrl
      if (rawUrl.includes('uddg=')) {
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/)
        if (uddgMatch) {
          try {
            actualUrl = decodeURIComponent(uddgMatch[1])
          } catch {
            continue
          }
        }
      }

      // Skip DuckDuckGo internal links
      if (actualUrl.includes('duckduckgo.com')) continue

      const title = stripHtml(rawTitle).trim()
      const snippet = snippets[i] ? stripHtml(snippets[i][1]).trim() : ''

      if (!title || title.length < 3) continue

      try {
        const hostname = new URL(actualUrl).hostname

        results.push({
          id: generateId(),
          title: truncate(title, 150),
          description: truncate(snippet, 300),
          url: actualUrl,
          source: 'googlecse' as const,
          category: 'web' as const,
          score: 0.85 - (i * 0.02),
          favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
        })
      } catch {
        // Skip invalid URLs
        continue
      }
    }

    // Strategy 2: If first approach failed, try simpler pattern
    if (results.length === 0) {
      const simpleResults = parseSimple(html, limit)
      results.push(...simpleResults)
    }

    return results.slice(0, limit)
  } catch (error) {
    console.error('Fallback search error:', error)
    return []
  }
}

/**
 * Simple fallback parser for DuckDuckGo HTML
 */
function parseSimple(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = []

  // Look for any links with uddg parameter
  const pattern = /href="[^"]*[?&]uddg=([^"&]+)[^"]*"[^>]*>([^<]+)/gi

  let match
  let count = 0
  const seen = new Set<string>()

  while ((match = pattern.exec(html)) !== null && count < limit) {
    try {
      const url = decodeURIComponent(match[1])
      const title = stripHtml(match[2]).trim()

      // Skip duplicates and internal links
      if (seen.has(url)) continue
      if (url.includes('duckduckgo.com')) continue
      if (!title || title.length < 5) continue

      seen.add(url)

      const hostname = new URL(url).hostname

      results.push({
        id: generateId(),
        title: truncate(title, 150),
        description: '',
        url: url,
        source: 'googlecse' as const,
        category: 'web' as const,
        score: 0.75 - (count * 0.02),
        favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
      })

      count++
    } catch {
      // Skip invalid entries
      continue
    }
  }

  return results
}
