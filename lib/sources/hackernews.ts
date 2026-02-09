import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface HNSearchResponse {
  hits?: Array<{
    objectID: string
    title: string
    url: string | null
    author: string
    points: number
    num_comments: number
    created_at: string
    story_text?: string
  }>
}

export const hackernewsAdapter: SourceAdapter = {
  config: {
    name: 'Hacker News',
    source: 'hackernews',
    category: 'news',
    enabled: true,
    timeout: 3000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      // Use Algolia's HN Search API
      const url = buildUrl('https://hn.algolia.com/api/v1/search', {
        query,
        hitsPerPage: limit,
        tags: 'story',
      })

      const data = await fetchWithTimeout<HNSearchResponse>(url, {
        timeout: this.config.timeout,
      })

      if (!data.hits) {
        return []
      }

      return data.hits.map(item => {
        const hnUrl = `https://news.ycombinator.com/item?id=${item.objectID}`

        return {
          id: generateId(),
          title: item.title,
          description: truncate(
            [
              item.story_text ? item.story_text.slice(0, 200) : null,
              `${item.points} points`,
              `${item.num_comments} comments`,
              `by ${item.author}`,
            ].filter(Boolean).join(' | '),
            300
          ),
          url: item.url || hnUrl,
          source: 'hackernews' as const,
          category: 'news' as const,
          timestamp: item.created_at,
          score: Math.min(1, 0.5 + (item.points / 500)),
          metadata: {
            points: item.points,
            comments: item.num_comments,
            author: item.author,
            hnUrl,
          },
          favicon: 'https://news.ycombinator.com/favicon.ico',
        }
      })
    } catch (error) {
      console.error('Hacker News search error:', error)
      return []
    }
  },
}

/**
 * Get front page stories
 */
export async function getHNFrontPage(limit = 10): Promise<SearchResult[]> {
  try {
    const url = buildUrl('https://hn.algolia.com/api/v1/search', {
      hitsPerPage: limit,
      tags: 'front_page',
    })

    const data = await fetchWithTimeout<HNSearchResponse>(url, { timeout: 3000 })

    if (!data.hits) return []

    return data.hits.map(item => ({
      id: generateId(),
      title: item.title,
      description: `${item.points} points | ${item.num_comments} comments | by ${item.author}`,
      url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
      source: 'hackernews' as const,
      category: 'news' as const,
      timestamp: item.created_at,
      score: Math.min(1, 0.5 + (item.points / 500)),
      favicon: 'https://news.ycombinator.com/favicon.ico',
    }))
  } catch {
    return []
  }
}
