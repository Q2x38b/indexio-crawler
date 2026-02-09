import type { SearchResult, SourceAdapter } from './types'
import { generateId, truncate } from '@/lib/utils'

// Pre-defined popular Census datasets for quick access
const POPULAR_DATASETS = [
  { id: 'acs/acs5', name: 'American Community Survey 5-Year', year: '2022', keywords: ['population', 'demographics', 'income', 'housing', 'education'] },
  { id: 'acs/acs1', name: 'American Community Survey 1-Year', year: '2022', keywords: ['population', 'demographics', 'income'] },
  { id: 'dec/pl', name: 'Decennial Census Redistricting', year: '2020', keywords: ['population', 'redistricting', 'census'] },
  { id: 'pep/population', name: 'Population Estimates', year: '2023', keywords: ['population', 'estimates', 'growth'] },
  { id: 'cbp', name: 'County Business Patterns', year: '2021', keywords: ['business', 'employment', 'industry', 'economy'] },
  { id: 'ecnbasic', name: 'Economic Census', year: '2017', keywords: ['economy', 'business', 'industry', 'revenue'] },
  { id: 'nonemp', name: 'Nonemployer Statistics', year: '2020', keywords: ['self-employed', 'business', 'small business'] },
  { id: 'sahie', name: 'Health Insurance Coverage', year: '2021', keywords: ['health', 'insurance', 'coverage', 'uninsured'] },
  { id: 'saipe', name: 'Poverty Estimates', year: '2022', keywords: ['poverty', 'income', 'low income'] },
  { id: 'timeseries/idb/5year', name: 'International Data Base', year: '2023', keywords: ['international', 'world', 'global', 'population'] },
]

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
      const queryLower = query.toLowerCase()
      const queryTerms = queryLower.split(/\s+/)

      // Score datasets by relevance
      const scored = POPULAR_DATASETS
        .map(ds => {
          let score = 0
          const nameLower = ds.name.toLowerCase()

          queryTerms.forEach(term => {
            if (nameLower.includes(term)) score += 3
            if (ds.keywords.some(k => k.includes(term))) score += 2
          })

          return { dataset: ds, score }
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(limit, 5))

      const results: SearchResult[] = scored.map((item, i) => {
        const ds = item.dataset
        return {
          id: generateId(),
          title: `${ds.name} (${ds.year})`,
          description: `US Census Bureau dataset. Keywords: ${ds.keywords.join(', ')}`,
          url: `https://data.census.gov/table?q=${encodeURIComponent(ds.name)}`,
          source: 'census' as const,
          category: 'research' as const,
          score: 0.85 - (i * 0.02),
          metadata: {
            datasetId: ds.id,
            year: ds.year,
            keywords: ds.keywords,
          },
          favicon: 'https://www.census.gov/favicon.ico',
        }
      })

      // Always add a search link to data.census.gov
      results.push({
        id: generateId(),
        title: `Search Census Data: "${query}"`,
        description: 'Search all US Census Bureau data tables and datasets.',
        url: `https://data.census.gov/table?q=${encodeURIComponent(query)}`,
        source: 'census' as const,
        category: 'research' as const,
        score: 0.75,
        metadata: { type: 'search_link' },
        favicon: 'https://www.census.gov/favicon.ico',
      })

      // Add Census QuickFacts link for location queries
      if (queryTerms.some(t => ['state', 'county', 'city', 'town', 'population'].includes(t))) {
        results.push({
          id: generateId(),
          title: `Census QuickFacts: ${query}`,
          description: 'Quick demographic and economic facts from the US Census Bureau.',
          url: `https://www.census.gov/quickfacts/fact/table/${query.replace(/\s+/g, '')}/PST045222`,
          source: 'census' as const,
          category: 'research' as const,
          score: 0.8,
          metadata: { type: 'quickfacts' },
          favicon: 'https://www.census.gov/favicon.ico',
        })
      }

      return results.slice(0, limit)
    } catch (error) {
      console.error('Census search error:', error)

      // Fallback: return search link
      return [{
        id: generateId(),
        title: `Search Census Data: "${query}"`,
        description: 'Search US Census Bureau data tables and datasets.',
        url: `https://data.census.gov/table?q=${encodeURIComponent(query)}`,
        source: 'census' as const,
        category: 'research' as const,
        score: 0.7,
        favicon: 'https://www.census.gov/favicon.ico',
      }]
    }
  },
}

// Get specific Census data via API
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

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}
