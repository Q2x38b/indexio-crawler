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
    timeout: 3000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      // DuckDuckGo Instant Answer API
      const url = buildUrl('https://api.duckduckgo.com/', {
        q: query,
        format: 'json',
        no_redirect: 1,
        no_html: 1,
        skip_disambig: 1,
      })

      const data = await fetchWithTimeout<DDGInstantAnswer>(url, {
        timeout: this.config.timeout,
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

      // Related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, limit - results.length)) {
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

      // Direct results
      if (data.Results) {
        for (const result of data.Results.slice(0, limit - results.length)) {
          if (result.FirstURL && result.Text) {
            results.push({
              id: generateId(),
              title: truncate(result.Text.split(' - ')[0] || result.Text, 100),
              description: truncate(result.Text, 300),
              url: result.FirstURL,
              source: 'duckduckgo' as const,
              category: 'web' as const,
              score: 0.75,
              favicon: 'https://duckduckgo.com/favicon.ico',
            })
          }
        }
      }

      return results.slice(0, limit)
    } catch (error) {
      console.error('DuckDuckGo search error:', error)
      return []
    }
  },
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
