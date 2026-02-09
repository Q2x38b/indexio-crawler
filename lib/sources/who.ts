import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface WHOIndicator {
  IndicatorCode: string
  IndicatorName: string
  Language: string
}

interface WHOCountryData {
  Id: number
  IndicatorCode: string
  SpatialDim: string
  TimeDim: string
  Value: string
  NumericValue: number
}

export const whoAdapter: SourceAdapter = {
  config: {
    name: 'WHO Health',
    source: 'who',
    category: 'research',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      // Search WHO GHO indicators
      const indicators = await searchIndicators(query, limit)
      return indicators
    } catch (error) {
      console.error('WHO search error:', error)
      return []
    }
  },
}

async function searchIndicators(query: string, limit: number): Promise<SearchResult[]> {
  try {
    // WHO GHO OData API
    const url = `https://ghoapi.azureedge.net/api/Indicator`
    const data = await fetchWithTimeout<{ value: WHOIndicator[] }>(url, {
      timeout: 4000,
    })

    if (!data.value?.length) return []

    const queryLower = query.toLowerCase()
    const matched = data.value
      .filter(ind =>
        ind.Language === 'EN' &&
        ind.IndicatorName.toLowerCase().includes(queryLower)
      )
      .slice(0, limit)

    return matched.map((ind, i) => ({
      id: generateId(),
      title: ind.IndicatorName,
      description: `WHO Global Health Observatory indicator. Code: ${ind.IndicatorCode}`,
      url: `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/${ind.IndicatorCode}`,
      source: 'who' as const,
      category: 'research' as const,
      score: 0.8 - (i * 0.02),
      metadata: {
        indicatorCode: ind.IndicatorCode,
        type: 'health_indicator',
      },
      favicon: 'https://www.who.int/favicon.ico',
    }))
  } catch {
    return []
  }
}

// Additional function to get specific indicator data
export async function getIndicatorData(indicatorCode: string, country?: string): Promise<WHOCountryData[]> {
  try {
    let url = `https://ghoapi.azureedge.net/api/${indicatorCode}`
    if (country) {
      url += `?$filter=SpatialDim eq '${country}'`
    }

    const data = await fetchWithTimeout<{ value: WHOCountryData[] }>(url, {
      timeout: 5000,
    })

    return data.value || []
  } catch {
    return []
  }
}
