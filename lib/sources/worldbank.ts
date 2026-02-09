import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface WorldBankIndicator {
  id: string
  name: string
  sourceNote: string
  sourceOrganization: string
  topics: Array<{ id: string; value: string }>
}

interface WorldBankCountry {
  id: string
  name: string
  region: { value: string }
  incomeLevel: { value: string }
  capitalCity: string
}

export const worldBankAdapter: SourceAdapter = {
  config: {
    name: 'World Bank',
    source: 'worldbank',
    category: 'research',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    try {
      // Search indicators
      const indicatorResults = await searchIndicators(query, Math.ceil(limit / 2))
      results.push(...indicatorResults)

      // Search countries
      const countryResults = await searchCountries(query, Math.floor(limit / 2))
      results.push(...countryResults)

      return results.slice(0, limit)
    } catch (error) {
      console.error('World Bank search error:', error)
      return []
    }
  },
}

async function searchIndicators(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://api.worldbank.org/v2/indicator?format=json&per_page=50`
    const data = await fetchWithTimeout<[unknown, WorldBankIndicator[]]>(url, {
      timeout: 4000,
    })

    if (!Array.isArray(data) || !data[1]) return []

    const indicators = data[1]
    const queryLower = query.toLowerCase()

    // Filter and rank by relevance
    const matched = indicators
      .filter(ind =>
        ind.name.toLowerCase().includes(queryLower) ||
        ind.sourceNote?.toLowerCase().includes(queryLower) ||
        ind.topics?.some(t => t.value.toLowerCase().includes(queryLower))
      )
      .slice(0, limit)

    return matched.map((ind, i) => ({
      id: generateId(),
      title: ind.name,
      description: truncate(ind.sourceNote || `Source: ${ind.sourceOrganization}`, 300),
      url: `https://data.worldbank.org/indicator/${ind.id}`,
      source: 'worldbank' as const,
      category: 'research' as const,
      score: 0.8 - (i * 0.02),
      metadata: {
        indicatorId: ind.id,
        topics: ind.topics?.map(t => t.value),
        organization: ind.sourceOrganization,
      },
      favicon: 'https://www.worldbank.org/favicon.ico',
    }))
  } catch {
    return []
  }
}

async function searchCountries(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = `https://api.worldbank.org/v2/country?format=json&per_page=300`
    const data = await fetchWithTimeout<[unknown, WorldBankCountry[]]>(url, {
      timeout: 4000,
    })

    if (!Array.isArray(data) || !data[1]) return []

    const countries = data[1]
    const queryLower = query.toLowerCase()

    const matched = countries
      .filter(c =>
        c.name.toLowerCase().includes(queryLower) ||
        c.capitalCity?.toLowerCase().includes(queryLower) ||
        c.region?.value?.toLowerCase().includes(queryLower)
      )
      .slice(0, limit)

    return matched.map((country, i) => ({
      id: generateId(),
      title: `${country.name} - Economic Data`,
      description: truncate(
        [
          country.capitalCity ? `Capital: ${country.capitalCity}` : null,
          country.region?.value ? `Region: ${country.region.value}` : null,
          country.incomeLevel?.value ? `Income: ${country.incomeLevel.value}` : null,
        ].filter(Boolean).join(' | '),
        300
      ),
      url: `https://data.worldbank.org/country/${country.id}`,
      source: 'worldbank' as const,
      category: 'research' as const,
      score: 0.75 - (i * 0.02),
      metadata: {
        countryCode: country.id,
        region: country.region?.value,
        incomeLevel: country.incomeLevel?.value,
        capital: country.capitalCity,
      },
      favicon: 'https://www.worldbank.org/favicon.ico',
    }))
  } catch {
    return []
  }
}
