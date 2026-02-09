import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate, stripHtml } from '@/lib/utils'

interface RedditSearchResponse {
  data?: {
    children?: Array<{
      data: {
        id: string
        title: string
        selftext: string
        url: string
        permalink: string
        subreddit: string
        score: number
        num_comments: number
        created_utc: number
        author: string
        is_self: boolean
      }
    }>
  }
}

export const redditAdapter: SourceAdapter = {
  config: {
    name: 'Reddit',
    source: 'reddit',
    category: 'news',
    enabled: true,
    timeout: 3000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const url = buildUrl('https://www.reddit.com/search.json', {
        q: query,
        limit,
        sort: 'relevance',
        t: 'all',
      })

      const data = await fetchWithTimeout<RedditSearchResponse>(url, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'Indexio-Crawler/1.0',
        },
      })

      if (!data.data?.children) {
        return []
      }

      return data.data.children.map(item => {
        const post = item.data
        const postUrl = `https://reddit.com${post.permalink}`

        return {
          id: generateId(),
          title: post.title,
          description: truncate(
            [
              post.selftext ? stripHtml(post.selftext).slice(0, 200) : null,
              `r/${post.subreddit}`,
              `${post.score} upvotes`,
              `${post.num_comments} comments`,
            ].filter(Boolean).join(' | '),
            300
          ),
          url: post.is_self ? postUrl : post.url,
          source: 'reddit' as const,
          category: 'news' as const,
          timestamp: new Date(post.created_utc * 1000).toISOString(),
          score: Math.min(1, 0.4 + (post.score / 10000)),
          metadata: {
            subreddit: post.subreddit,
            upvotes: post.score,
            comments: post.num_comments,
            author: post.author,
            redditUrl: postUrl,
          },
          favicon: 'https://www.reddit.com/favicon.ico',
        }
      })
    } catch (error) {
      console.error('Reddit search error:', error)
      return []
    }
  },
}

/**
 * Search a specific subreddit
 */
export async function searchSubreddit(
  subreddit: string,
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  try {
    const url = buildUrl(`https://www.reddit.com/r/${subreddit}/search.json`, {
      q: query,
      limit,
      restrict_sr: 'on',
      sort: 'relevance',
    })

    const data = await fetchWithTimeout<RedditSearchResponse>(url, {
      timeout: 3000,
      headers: {
        'User-Agent': 'Indexio-Crawler/1.0',
      },
    })

    if (!data.data?.children) return []

    return data.data.children.map(item => {
      const post = item.data
      return {
        id: generateId(),
        title: post.title,
        description: truncate(post.selftext || `${post.score} upvotes | ${post.num_comments} comments`, 300),
        url: `https://reddit.com${post.permalink}`,
        source: 'reddit' as const,
        category: 'news' as const,
        timestamp: new Date(post.created_utc * 1000).toISOString(),
        score: Math.min(1, 0.4 + (post.score / 10000)),
        favicon: 'https://www.reddit.com/favicon.ico',
      }
    })
  } catch {
    return []
  }
}
