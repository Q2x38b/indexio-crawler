import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface NpmSearchResponse {
  objects?: Array<{
    package: {
      name: string
      version: string
      description?: string
      keywords?: string[]
      date: string
      links: {
        npm: string
        homepage?: string
        repository?: string
      }
      publisher: {
        username: string
      }
    }
    score: {
      final: number
      detail: {
        quality: number
        popularity: number
        maintenance: number
      }
    }
  }>
}

interface PyPISearchResponse {
  info: {
    name: string
    version: string
    summary: string
    home_page?: string
    project_urls?: Record<string, string>
    author?: string
    keywords?: string
  }
  releases: Record<string, Array<{ upload_time: string }>>
}

export const npmAdapter: SourceAdapter = {
  config: {
    name: 'npm',
    source: 'npm',
    category: 'code',
    enabled: true,
    timeout: 3000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const url = buildUrl('https://registry.npmjs.org/-/v1/search', {
        text: query,
        size: limit,
      })

      const data = await fetchWithTimeout<NpmSearchResponse>(url, {
        timeout: this.config.timeout,
      })

      if (!data.objects) {
        return []
      }

      return data.objects.map(item => {
        const pkg = item.package
        const scorePercent = Math.round(item.score.final * 100)

        return {
          id: generateId(),
          title: `${pkg.name}@${pkg.version}`,
          description: truncate(
            [
              pkg.description || 'No description',
              `Score: ${scorePercent}%`,
              pkg.keywords?.slice(0, 3).join(', '),
            ].filter(Boolean).join(' | '),
            300
          ),
          url: pkg.links.npm,
          source: 'npm' as const,
          category: 'code' as const,
          timestamp: pkg.date,
          score: item.score.final,
          metadata: {
            version: pkg.version,
            homepage: pkg.links.homepage,
            repository: pkg.links.repository,
            publisher: pkg.publisher.username,
            quality: item.score.detail.quality,
            popularity: item.score.detail.popularity,
            maintenance: item.score.detail.maintenance,
          },
          favicon: 'https://static.npmjs.com/favicon.ico',
        }
      })
    } catch (error) {
      console.error('npm search error:', error)
      return []
    }
  },
}

export const pypiAdapter: SourceAdapter = {
  config: {
    name: 'PyPI',
    source: 'pypi',
    category: 'code',
    enabled: true,
    timeout: 3000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      // PyPI doesn't have a great search API, but we can search the simple index
      // Using the JSON API for specific packages
      const url = `https://pypi.org/pypi/${encodeURIComponent(query)}/json`

      const data = await fetchWithTimeout<PyPISearchResponse>(url, {
        timeout: this.config.timeout,
      })

      if (!data.info) {
        // Try warehouse search API as fallback
        return searchWarehouse(query, limit)
      }

      const releases = Object.entries(data.releases)
        .filter(([_, files]) => files.length > 0)
        .sort((a, b) => {
          const dateA = a[1][0]?.upload_time || ''
          const dateB = b[1][0]?.upload_time || ''
          return dateB.localeCompare(dateA)
        })

      const latestRelease = releases[0]
      const releaseDate = latestRelease?.[1]?.[0]?.upload_time

      return [{
        id: generateId(),
        title: `${data.info.name}==${data.info.version}`,
        description: truncate(
          [
            data.info.summary || 'No description',
            data.info.author ? `by ${data.info.author}` : null,
          ].filter(Boolean).join(' | '),
          300
        ),
        url: `https://pypi.org/project/${data.info.name}/`,
        source: 'pypi' as const,
        category: 'code' as const,
        timestamp: releaseDate,
        score: 0.75,
        metadata: {
          version: data.info.version,
          homepage: data.info.home_page,
          author: data.info.author,
          projectUrls: data.info.project_urls,
        },
        favicon: 'https://pypi.org/static/images/favicon.35549fe8.ico',
      }]
    } catch (error) {
      // Package not found, try search
      return searchWarehouse(query, limit)
    }
  },
}

/**
 * Search PyPI warehouse (unofficial API)
 */
async function searchWarehouse(query: string, limit: number): Promise<SearchResult[]> {
  try {
    // Use the XML-RPC search via a proxy or simple package list
    // For now, return empty as PyPI's search API is limited
    const url = `https://pypi.org/simple/`
    // This returns a list of all packages, which is too large to parse

    // Alternative: Use Google site search
    return []
  } catch {
    return []
  }
}

/**
 * Get package details
 */
export async function getPackageDetails(name: string, registry: 'npm' | 'pypi'): Promise<SearchResult | null> {
  try {
    if (registry === 'npm') {
      const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`
      const data = await fetchWithTimeout<{
        name: string
        'dist-tags': { latest: string }
        description?: string
        homepage?: string
        time: Record<string, string>
      }>(url, { timeout: 3000 })

      return {
        id: generateId(),
        title: `${data.name}@${data['dist-tags'].latest}`,
        description: data.description || 'No description',
        url: `https://www.npmjs.com/package/${data.name}`,
        source: 'npm' as const,
        category: 'code' as const,
        timestamp: data.time?.modified,
        score: 0.85,
      }
    } else {
      const url = `https://pypi.org/pypi/${encodeURIComponent(name)}/json`
      const data = await fetchWithTimeout<PyPISearchResponse>(url, { timeout: 3000 })

      return {
        id: generateId(),
        title: `${data.info.name}==${data.info.version}`,
        description: data.info.summary || 'No description',
        url: `https://pypi.org/project/${data.info.name}/`,
        source: 'pypi' as const,
        category: 'code' as const,
        score: 0.85,
      }
    }
  } catch {
    return null
  }
}
