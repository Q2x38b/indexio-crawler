import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface CrossRefWork {
  DOI: string
  title: string[]
  author?: Array<{ given?: string; family?: string; name?: string }>
  'container-title'?: string[]
  published?: { 'date-parts': number[][] }
  type: string
  'is-referenced-by-count': number
  abstract?: string
  subject?: string[]
  publisher?: string
  URL: string
  link?: Array<{ URL: string; 'content-type': string }>
}

interface CrossRefResponse {
  status: string
  message: {
    items: CrossRefWork[]
    'total-results': number
  }
}

export const crossrefAdapter: SourceAdapter = {
  config: {
    name: 'CrossRef',
    source: 'crossref',
    category: 'research',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      // Check if it's a DOI lookup
      if (query.startsWith('10.') || query.includes('doi.org')) {
        const doi = extractDOI(query)
        if (doi) {
          const result = await lookupDOI(doi)
          return result ? [result] : []
        }
      }

      // Regular search
      const url = new URL('https://api.crossref.org/works')
      url.searchParams.set('query', query)
      url.searchParams.set('rows', String(limit))
      url.searchParams.set('sort', 'relevance')
      url.searchParams.set('order', 'desc')

      const data = await fetchWithTimeout<CrossRefResponse>(url.toString(), {
        timeout: 5000,
        headers: {
          'User-Agent': 'IndexioCrawler/1.0 (mailto:contact@indexio.dev)',
        },
      })

      if (data.status !== 'ok' || !data.message?.items?.length) {
        return []
      }

      return data.message.items.map((work, i) => formatWork(work, i))
    } catch (error) {
      console.error('CrossRef search error:', error)
      return []
    }
  },
}

async function lookupDOI(doi: string): Promise<SearchResult | null> {
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`
    const data = await fetchWithTimeout<{ status: string; message: CrossRefWork }>(url, {
      timeout: 4000,
      headers: {
        'User-Agent': 'IndexioCrawler/1.0 (mailto:contact@indexio.dev)',
      },
    })

    if (data.status !== 'ok' || !data.message) {
      return null
    }

    return formatWork(data.message, 0)
  } catch {
    return null
  }
}

function formatWork(work: CrossRefWork, index: number): SearchResult {
  const title = work.title?.[0] || 'Untitled'
  const authors = work.author?.slice(0, 4).map(a =>
    a.name || [a.given, a.family].filter(Boolean).join(' ')
  ).join(', ') || 'Unknown authors'

  const journal = work['container-title']?.[0]
  const year = work.published?.['date-parts']?.[0]?.[0]
  const citations = work['is-referenced-by-count'] || 0

  // Clean abstract if present
  let abstract = work.abstract || ''
  abstract = abstract.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

  return {
    id: generateId(),
    title: truncate(title, 200),
    description: truncate(
      [
        authors,
        journal ? `Published in: ${journal}` : null,
        year ? `(${year})` : null,
        abstract ? abstract.slice(0, 150) : null,
      ].filter(Boolean).join(' | '),
      300
    ),
    url: work.URL || `https://doi.org/${work.DOI}`,
    source: 'crossref' as const,
    category: 'research' as const,
    timestamp: year ? `${year}-01-01` : undefined,
    score: 0.85 - (index * 0.02),
    metadata: {
      doi: work.DOI,
      type: work.type,
      citations,
      authors: work.author?.slice(0, 10).map(a => a.name || [a.given, a.family].filter(Boolean).join(' ')),
      journal,
      year,
      subjects: work.subject?.slice(0, 5),
      publisher: work.publisher,
      pdfLink: work.link?.find(l => l['content-type'] === 'application/pdf')?.URL,
    },
    favicon: 'https://www.crossref.org/favicon.ico',
  }
}

function extractDOI(input: string): string | null {
  // Match DOI patterns
  const doiMatch = input.match(/10\.\d{4,}\/[^\s]+/)
  if (doiMatch) {
    return doiMatch[0].replace(/[.,;]$/, '') // Remove trailing punctuation
  }

  // Extract from URL
  const urlMatch = input.match(/doi\.org\/(10\.\d{4,}\/[^\s]+)/)
  if (urlMatch) {
    return urlMatch[1].replace(/[.,;]$/, '')
  }

  return null
}

// Search by author
export async function searchByAuthor(authorName: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = new URL('https://api.crossref.org/works')
    url.searchParams.set('query.author', authorName)
    url.searchParams.set('rows', String(limit))
    url.searchParams.set('sort', 'published')
    url.searchParams.set('order', 'desc')

    const data = await fetchWithTimeout<CrossRefResponse>(url.toString(), {
      timeout: 5000,
      headers: {
        'User-Agent': 'IndexioCrawler/1.0 (mailto:contact@indexio.dev)',
      },
    })

    if (data.status !== 'ok' || !data.message?.items?.length) {
      return []
    }

    return data.message.items.map((work, i) => formatWork(work, i))
  } catch {
    return []
  }
}
