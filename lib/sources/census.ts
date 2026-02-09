import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface CensusDataset {
  c_dataset: string[]
  c_vintage?: string
  title: string
  description: string
  distribution: Array<{
    accessURL: string
    format: string
  }>
  keyword?: string[]
  modified: string
}

interface CensusResponse {
  dataset: CensusDataset[]
}

export const censusAdapter: SourceAdapter = {
  config: {
    name: 'US Census',
    source: 'census',
    category: 'research',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      // Search Census data catalog
      const url = 'https://api.census.gov/data.json'
      const data = await fetchWithTimeout<CensusResponse>(url, {
        timeout: 5000,
      })

      if (!data.dataset?.length) return []

      const queryLower = query.toLowerCase()
      const queryTerms = queryLower.split(/\s+/)

      // Score and filter datasets
      const scored = data.dataset
        .map(ds => {
          let score = 0
          const titleLower = ds.title.toLowerCase()
          const descLower = (ds.description || '').toLowerCase()
          const keywords = (ds.keyword || []).map(k => k.toLowerCase())

          // Title match (highest weight)
          queryTerms.forEach(term => {
            if (titleLower.includes(term)) score += 3
            if (descLower.includes(term)) score += 1
            if (keywords.some(k => k.includes(term))) score += 2
          })

          return { dataset: ds, score }
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)

      return scored.map((item, i) => {
        const ds = item.dataset
        const apiUrl = ds.distribution?.find(d => d.format === 'API')?.accessURL
        const datasetPath = ds.c_dataset?.join('/') || ''
        const vintage = ds.c_vintage || ''

        return {
          id: generateId(),
          title: ds.title,
          description: truncate(ds.description || '', 300),
          url: apiUrl || `https://data.census.gov/table?q=${encodeURIComponent(ds.title)}`,
          source: 'census' as const,
          category: 'research' as const,
          timestamp: ds.modified,
          score: 0.85 - (i * 0.02),
          metadata: {
            datasetPath,
            vintage,
            keywords: ds.keyword?.slice(0, 5),
            hasAPI: !!apiUrl,
          },
          favicon: 'https://www.census.gov/favicon.ico',
        }
      })
    } catch (error) {
      console.error('Census search error:', error)
      return []
    }
  },
}

// Get specific Census data
export async function getCensusData(
  dataset: string,
  variables: string[],
  geography: string = 'us:*'
): Promise<string[][] | null> {
  try {
    const apiKey = process.env.CENSUS_API_KEY
    let url = `https://api.census.gov/data/${dataset}?get=${variables.join(',')}&for=${geography}`
    if (apiKey) {
      url += `&key=${apiKey}`
    }

    const data = await fetchWithTimeout<string[][]>(url, {
      timeout: 5000,
    })

    return data
  } catch {
    return null
  }
}
