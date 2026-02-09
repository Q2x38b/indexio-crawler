import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate, stripHtml } from '@/lib/utils'

interface DevtoArticle {
  id: number
  title: string
  description: string
  url: string
  published_at: string
  tag_list: string[]
  positive_reactions_count: number
  comments_count: number
  user: {
    name: string
    username: string
  }
  reading_time_minutes: number
}

export const devtoAdapter: SourceAdapter = {
  config: {
    name: 'Dev.to',
    source: 'devto',
    category: 'code',
    enabled: true,
    timeout: 3000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const url = buildUrl('https://dev.to/api/articles', {
        per_page: limit,
        tag: query.replace(/\s+/g, '').toLowerCase(),
      })

      // Dev.to search by tag or just get recent articles
      let data = await fetchWithTimeout<DevtoArticle[]>(url, {
        timeout: this.config.timeout,
      })

      // If no results with tag, try searching
      if (!data.length) {
        const searchUrl = buildUrl('https://dev.to/search/feed_content', {
          per_page: limit,
          page: 0,
          search_fields: query,
          class_name: 'Article',
        })

        try {
          const searchData = await fetchWithTimeout<{ result: DevtoArticle[] }>(searchUrl, {
            timeout: this.config.timeout,
          })
          data = searchData.result || []
        } catch {
          // Use fallback
          const fallbackUrl = buildUrl('https://dev.to/api/articles', {
            per_page: limit,
            top: 7,
          })
          data = await fetchWithTimeout<DevtoArticle[]>(fallbackUrl, {
            timeout: this.config.timeout,
          })
        }
      }

      return data.map(article => ({
        id: generateId(),
        title: article.title,
        description: truncate(
          [
            article.description,
            `${article.reading_time_minutes} min read`,
            `${article.positive_reactions_count} reactions`,
            `by ${article.user.name}`,
            article.tag_list.slice(0, 3).join(', '),
          ].filter(Boolean).join(' | '),
          300
        ),
        url: article.url,
        source: 'devto' as const,
        category: 'code' as const,
        timestamp: article.published_at,
        score: Math.min(1, 0.5 + (article.positive_reactions_count / 500)),
        metadata: {
          reactions: article.positive_reactions_count,
          comments: article.comments_count,
          readingTime: article.reading_time_minutes,
          tags: article.tag_list,
          author: article.user,
        },
        favicon: 'https://dev.to/favicon.ico',
      }))
    } catch (error) {
      console.error('Dev.to search error:', error)
      return []
    }
  },
}

/**
 * Get trending articles
 */
export async function getDevtoTrending(limit = 10): Promise<SearchResult[]> {
  try {
    const url = buildUrl('https://dev.to/api/articles', {
      per_page: limit,
      top: 7, // Last 7 days
    })

    const data = await fetchWithTimeout<DevtoArticle[]>(url, { timeout: 3000 })

    return data.map(article => ({
      id: generateId(),
      title: article.title,
      description: `${article.positive_reactions_count} reactions | ${article.reading_time_minutes} min read`,
      url: article.url,
      source: 'devto' as const,
      category: 'code' as const,
      timestamp: article.published_at,
      score: Math.min(1, 0.5 + (article.positive_reactions_count / 500)),
      favicon: 'https://dev.to/favicon.ico',
    }))
  } catch {
    return []
  }
}
