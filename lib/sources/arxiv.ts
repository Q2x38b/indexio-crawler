import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate, stripHtml } from '@/lib/utils'

interface ArxivEntry {
  id: string[]
  title: string[]
  summary: string[]
  published: string[]
  updated: string[]
  author: Array<{ name: string[] }>
  link: Array<{ $: { href: string; type?: string } }>
  category?: Array<{ $: { term: string } }>
}

export const arxivAdapter: SourceAdapter = {
  config: {
    name: 'arXiv',
    source: 'arxiv',
    category: 'research',
    enabled: true,
    timeout: 4000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const url = buildUrl('https://export.arxiv.org/api/query', {
        search_query: `all:${query}`,
        start: 0,
        max_results: limit,
        sortBy: 'relevance',
        sortOrder: 'descending',
      })

      const response = await fetch(url, {
        headers: { 'Accept': 'application/xml' },
      })

      if (!response.ok) {
        throw new Error(`arXiv API error: ${response.status}`)
      }

      const xml = await response.text()
      return parseArxivXml(xml)
    } catch (error) {
      console.error('arXiv search error:', error)
      return []
    }
  },
}

/**
 * Parse arXiv XML response
 */
function parseArxivXml(xml: string): SearchResult[] {
  const results: SearchResult[] = []

  // Simple XML parsing for arXiv entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]

    const id = extractXmlValue(entry, 'id')
    const title = extractXmlValue(entry, 'title')
    const summary = extractXmlValue(entry, 'summary')
    const published = extractXmlValue(entry, 'published')

    // Extract authors
    const authorRegex = /<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g
    const authors: string[] = []
    let authorMatch
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push(authorMatch[1])
    }

    // Extract categories
    const categoryRegex = /<category[^>]*term="([^"]+)"/g
    const categories: string[] = []
    let catMatch
    while ((catMatch = categoryRegex.exec(entry)) !== null) {
      categories.push(catMatch[1])
    }

    if (id && title) {
      const arxivId = id.split('/abs/')[1] || id

      results.push({
        id: generateId(),
        title: truncate(stripHtml(title.replace(/\s+/g, ' ')), 200),
        description: truncate(
          [
            stripHtml(summary?.replace(/\s+/g, ' ') || '').slice(0, 200),
            authors.length > 0 ? `Authors: ${authors.slice(0, 3).join(', ')}${authors.length > 3 ? '...' : ''}` : null,
            categories.length > 0 ? categories.slice(0, 2).join(', ') : null,
          ].filter(Boolean).join(' | '),
          300
        ),
        url: `https://arxiv.org/abs/${arxivId}`,
        source: 'arxiv' as const,
        category: 'research' as const,
        timestamp: published ?? undefined,
        score: 0.75,
        metadata: {
          arxivId,
          authors,
          categories,
          pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
        },
        favicon: 'https://arxiv.org/favicon.ico',
      })
    }
  }

  return results
}

function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : null
}
