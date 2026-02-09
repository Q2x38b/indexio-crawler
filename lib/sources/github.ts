import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate, formatDate } from '@/lib/utils'

interface GitHubSearchResponse {
  items?: Array<{
    id: number
    name: string
    full_name: string
    html_url: string
    description: string | null
    stargazers_count: number
    language: string | null
    updated_at: string
    topics?: string[]
  }>
}

interface GitHubCodeSearchResponse {
  items?: Array<{
    name: string
    path: string
    html_url: string
    repository: {
      full_name: string
      description: string | null
    }
  }>
}

export const githubAdapter: SourceAdapter = {
  config: {
    name: 'GitHub',
    source: 'github',
    category: 'code',
    enabled: true,
    timeout: 3000,
    rateLimit: 10, // 10 requests per minute unauthenticated
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
      }

      // Add token if available for higher rate limits
      const token = process.env.GITHUB_TOKEN
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      // Search repositories
      const repoUrl = buildUrl('https://api.github.com/search/repositories', {
        q: query,
        per_page: limit,
        sort: 'stars',
        order: 'desc',
      })

      const data = await fetchWithTimeout<GitHubSearchResponse>(repoUrl, {
        timeout: this.config.timeout,
        headers,
      })

      if (!data.items) {
        return []
      }

      return data.items.map(item => ({
        id: generateId(),
        title: item.full_name,
        description: truncate(
          [
            item.description || 'No description',
            item.language ? `Language: ${item.language}` : null,
            `Stars: ${item.stargazers_count.toLocaleString()}`,
          ].filter(Boolean).join(' | '),
          300
        ),
        url: item.html_url,
        source: 'github' as const,
        category: 'code' as const,
        timestamp: item.updated_at,
        score: Math.min(1, 0.5 + (item.stargazers_count / 100000)),
        metadata: {
          stars: item.stargazers_count,
          language: item.language,
          topics: item.topics,
        },
        favicon: 'https://github.com/favicon.ico',
      }))
    } catch (error) {
      console.error('GitHub search error:', error)
      return []
    }
  },
}

/**
 * Search GitHub code (requires authentication for better results)
 */
export async function searchGitHubCode(query: string, limit = 5): Promise<SearchResult[]> {
  try {
    const token = process.env.GITHUB_TOKEN
    if (!token) return []

    const url = buildUrl('https://api.github.com/search/code', {
      q: query,
      per_page: limit,
    })

    const data = await fetchWithTimeout<GitHubCodeSearchResponse>(url, {
      timeout: 3000,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!data.items) return []

    return data.items.map(item => ({
      id: generateId(),
      title: `${item.repository.full_name}/${item.path}`,
      description: truncate(item.repository.description || `Code file: ${item.name}`, 300),
      url: item.html_url,
      source: 'github' as const,
      category: 'code' as const,
      score: 0.7,
      favicon: 'https://github.com/favicon.ico',
    }))
  } catch {
    return []
  }
}
