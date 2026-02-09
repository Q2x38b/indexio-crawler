import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate, stripHtml } from '@/lib/utils'

interface DDGInstantAnswer {
  AbstractText?: string
  AbstractURL?: string
  AbstractSource?: string
  Heading?: string
  Image?: string
  RelatedTopics?: Array<{
    FirstURL?: string
    Text?: string
    Icon?: {
      URL?: string
    }
  }>
  Results?: Array<{
    FirstURL?: string
    Text?: string
  }>
  Infobox?: {
    content?: Array<{
      label: string
      value: string
    }>
  }
  Type?: string
  Definition?: string
  DefinitionURL?: string
}

export const duckduckgoAdapter: SourceAdapter = {
  config: {
    name: 'DuckDuckGo',
    source: 'duckduckgo',
    category: 'web',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    // Run both searches in parallel for comprehensive results
    const [instantResults, htmlResults] = await Promise.all([
      searchInstantAnswer(query),
      searchHTML(query, limit),
    ])

    results.push(...instantResults)
    results.push(...htmlResults)

    // Deduplicate by URL
    const seen = new Set<string>()
    const unique = results.filter(r => {
      if (seen.has(r.url)) return false
      seen.add(r.url)
      return true
    })

    return unique.slice(0, limit)
  },
}

/**
 * Search using DuckDuckGo Instant Answer API (Wikipedia-style quick answers)
 */
async function searchInstantAnswer(query: string): Promise<SearchResult[]> {
  try {
    const url = buildUrl('https://api.duckduckgo.com/', {
      q: query,
      format: 'json',
      no_redirect: 1,
      no_html: 1,
      skip_disambig: 1,
    })

    const data = await fetchWithTimeout<DDGInstantAnswer>(url, {
      timeout: 3000,
    })

    const results: SearchResult[] = []

    // Main abstract result
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        id: generateId(),
        title: data.Heading || query,
        description: truncate(stripHtml(data.AbstractText), 300),
        url: data.AbstractURL,
        source: 'duckduckgo' as const,
        category: 'web' as const,
        score: 0.9,
        metadata: {
          source: data.AbstractSource,
          image: data.Image,
          type: data.Type,
          infobox: data.Infobox?.content,
        },
        favicon: 'https://duckduckgo.com/favicon.ico',
      })
    }

    // Definition
    if (data.Definition && data.DefinitionURL) {
      results.push({
        id: generateId(),
        title: `Definition: ${data.Heading || query}`,
        description: truncate(data.Definition, 300),
        url: data.DefinitionURL,
        source: 'duckduckgo' as const,
        category: 'web' as const,
        score: 0.85,
        favicon: 'https://duckduckgo.com/favicon.ico',
      })
    }

    // Related topics (these often have useful links)
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 3)) {
        if (topic.FirstURL && topic.Text) {
          results.push({
            id: generateId(),
            title: truncate(topic.Text.split(' - ')[0] || topic.Text, 100),
            description: truncate(topic.Text, 300),
            url: topic.FirstURL,
            source: 'duckduckgo' as const,
            category: 'web' as const,
            score: 0.7,
            favicon: topic.Icon?.URL || 'https://duckduckgo.com/favicon.ico',
          })
        }
      }
    }

    return results
  } catch (error) {
    console.error('DDG Instant Answer error:', error)
    return []
  }
}

/**
 * Search using DuckDuckGo HTML page (actual web results)
 */
async function searchHTML(query: string, limit: number): Promise<SearchResult[]> {
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

    // Parse result blocks - each result is in a div with class "result"
    // Link is in <a class="result__a"> and snippet in <a class="result__snippet">

    // Match result blocks more robustly
    const resultPattern = /<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>)?/gi

    let match
    let count = 0
    while ((match = resultPattern.exec(html)) !== null && count < limit) {
      const rawUrl = match[1]
      const title = match[2]?.trim()
      const snippet = match[3]?.trim() || ''

      if (!rawUrl || !title) continue

      // Decode DuckDuckGo redirect URL
      let actualUrl = rawUrl
      if (rawUrl.includes('uddg=')) {
        const uddgMatch = rawUrl.match(/uddg=([^&]+)/)
        if (uddgMatch) {
          actualUrl = decodeURIComponent(uddgMatch[1])
        }
      }

      // Skip DuckDuckGo internal links
      if (actualUrl.includes('duckduckgo.com')) continue

      results.push({
        id: generateId(),
        title: stripHtml(title),
        description: truncate(stripHtml(snippet), 300),
        url: actualUrl,
        source: 'duckduckgo' as const,
        category: 'web' as const,
        score: 0.8 - (count * 0.02), // Decrease score by position
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(actualUrl).hostname}&sz=32`,
      })

      count++
    }

    // If the regex didn't work, try a simpler approach
    if (results.length === 0) {
      const simpleResults = parseHTMLSimple(html, limit)
      results.push(...simpleResults)
    }

    return results
  } catch (error) {
    console.error('DDG HTML search error:', error)
    return []
  }
}

/**
 * Simple fallback HTML parser
 */
function parseHTMLSimple(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = []

  // Look for links with uddg parameter (actual search results)
  const linkPattern = /href="[^"]*uddg=([^"&]+)[^"]*"[^>]*>([^<]+)<\/a>/gi

  let match
  let count = 0
  while ((match = linkPattern.exec(html)) !== null && count < limit) {
    try {
      const url = decodeURIComponent(match[1])
      const title = match[2]?.trim()

      if (!url || !title) continue
      if (url.includes('duckduckgo.com')) continue
      if (title.length < 5) continue

      results.push({
        id: generateId(),
        title: stripHtml(title),
        description: '',
        url: url,
        source: 'duckduckgo' as const,
        category: 'web' as const,
        score: 0.75 - (count * 0.02),
        favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`,
      })

      count++
    } catch {
      // Skip invalid URLs
      continue
    }
  }

  return results
}

/**
 * Get instant answer for a query
 */
export async function getInstantAnswer(query: string): Promise<{
  answer: string | null
  source: string | null
  url: string | null
}> {
  try {
    const url = buildUrl('https://api.duckduckgo.com/', {
      q: query,
      format: 'json',
      no_redirect: 1,
      no_html: 1,
    })

    const data = await fetchWithTimeout<DDGInstantAnswer>(url, { timeout: 2000 })

    if (data.AbstractText) {
      return {
        answer: data.AbstractText,
        source: data.AbstractSource || null,
        url: data.AbstractURL || null,
      }
    }

    if (data.Definition) {
      return {
        answer: data.Definition,
        source: 'Dictionary',
        url: data.DefinitionURL || null,
      }
    }

    return { answer: null, source: null, url: null }
  } catch {
    return { answer: null, source: null, url: null }
  }
}
