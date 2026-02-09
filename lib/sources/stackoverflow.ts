import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate, stripHtml } from '@/lib/utils'

interface StackOverflowSearchResponse {
  items?: Array<{
    question_id: number
    title: string
    body_markdown?: string
    link: string
    score: number
    answer_count: number
    is_answered: boolean
    creation_date: number
    tags: string[]
    owner?: {
      display_name: string
    }
  }>
}

export const stackoverflowAdapter: SourceAdapter = {
  config: {
    name: 'Stack Overflow',
    source: 'stackoverflow',
    category: 'code',
    enabled: true,
    timeout: 3000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const url = buildUrl('https://api.stackexchange.com/2.3/search/advanced', {
        q: query,
        pagesize: limit,
        order: 'desc',
        sort: 'relevance',
        site: 'stackoverflow',
        filter: 'withbody',
      })

      const data = await fetchWithTimeout<StackOverflowSearchResponse>(url, {
        timeout: this.config.timeout,
      })

      if (!data.items) {
        return []
      }

      return data.items.map(item => ({
        id: generateId(),
        title: stripHtml(item.title),
        description: truncate(
          [
            item.body_markdown ? stripHtml(item.body_markdown).slice(0, 150) : null,
            `${item.score} votes`,
            `${item.answer_count} answers`,
            item.is_answered ? 'Answered' : 'Unanswered',
            item.tags.slice(0, 3).join(', '),
          ].filter(Boolean).join(' | '),
          300
        ),
        url: item.link,
        source: 'stackoverflow' as const,
        category: 'code' as const,
        timestamp: new Date(item.creation_date * 1000).toISOString(),
        score: Math.min(1, 0.5 + (item.score / 100) + (item.is_answered ? 0.2 : 0)),
        metadata: {
          votes: item.score,
          answers: item.answer_count,
          isAnswered: item.is_answered,
          tags: item.tags,
        },
        favicon: 'https://stackoverflow.com/favicon.ico',
      }))
    } catch (error) {
      console.error('Stack Overflow search error:', error)
      return []
    }
  },
}

/**
 * Get questions by tag
 */
export async function getQuestionsByTag(tag: string, limit = 10): Promise<SearchResult[]> {
  try {
    const url = buildUrl('https://api.stackexchange.com/2.3/questions', {
      tagged: tag,
      pagesize: limit,
      order: 'desc',
      sort: 'votes',
      site: 'stackoverflow',
    })

    const data = await fetchWithTimeout<StackOverflowSearchResponse>(url, { timeout: 3000 })

    if (!data.items) return []

    return data.items.map(item => ({
      id: generateId(),
      title: stripHtml(item.title),
      description: `${item.score} votes | ${item.answer_count} answers | ${item.tags.join(', ')}`,
      url: item.link,
      source: 'stackoverflow' as const,
      category: 'code' as const,
      timestamp: new Date(item.creation_date * 1000).toISOString(),
      score: Math.min(1, 0.5 + (item.score / 100)),
      favicon: 'https://stackoverflow.com/favicon.ico',
    }))
  } catch {
    return []
  }
}
