import type { SearchResult, SourceAdapter } from './types'
import { generateId, truncate } from '@/lib/utils'

// Pre-defined popular World Bank indicators for quick access
const POPULAR_INDICATORS = [
  { id: 'NY.GDP.MKTP.CD', name: 'GDP (current US$)', keywords: ['gdp', 'economy', 'economic', 'output', 'gross domestic'] },
  { id: 'NY.GDP.PCAP.CD', name: 'GDP per capita (current US$)', keywords: ['gdp', 'per capita', 'income', 'economy'] },
  { id: 'NY.GDP.MKTP.KD.ZG', name: 'GDP growth (annual %)', keywords: ['gdp', 'growth', 'economy', 'economic growth'] },
  { id: 'SP.POP.TOTL', name: 'Population, total', keywords: ['population', 'people', 'demographic'] },
  { id: 'SP.POP.GROW', name: 'Population growth (annual %)', keywords: ['population', 'growth', 'demographic'] },
  { id: 'SL.UEM.TOTL.ZS', name: 'Unemployment, total', keywords: ['unemployment', 'jobs', 'labor', 'employment'] },
  { id: 'FP.CPI.TOTL.ZG', name: 'Inflation, consumer prices', keywords: ['inflation', 'cpi', 'prices', 'cost of living'] },
  { id: 'SI.POV.NAHC', name: 'Poverty headcount ratio', keywords: ['poverty', 'poor', 'income inequality'] },
  { id: 'SI.POV.GINI', name: 'GINI index', keywords: ['gini', 'inequality', 'income distribution'] },
  { id: 'SE.ADT.LITR.ZS', name: 'Literacy rate, adult', keywords: ['literacy', 'education', 'reading'] },
  { id: 'SE.XPD.TOTL.GD.ZS', name: 'Government expenditure on education', keywords: ['education', 'spending', 'government'] },
  { id: 'SH.XPD.CHEX.GD.ZS', name: 'Current health expenditure', keywords: ['health', 'healthcare', 'spending', 'medical'] },
  { id: 'SH.DYN.MORT', name: 'Under-5 mortality rate', keywords: ['mortality', 'child', 'death rate', 'health'] },
  { id: 'SP.DYN.LE00.IN', name: 'Life expectancy at birth', keywords: ['life expectancy', 'lifespan', 'mortality'] },
  { id: 'EG.USE.ELEC.KH.PC', name: 'Electric power consumption', keywords: ['electricity', 'energy', 'power', 'consumption'] },
  { id: 'EN.ATM.CO2E.PC', name: 'CO2 emissions per capita', keywords: ['co2', 'carbon', 'emissions', 'climate', 'environment'] },
  { id: 'NE.EXP.GNFS.ZS', name: 'Exports of goods and services', keywords: ['exports', 'trade', 'international'] },
  { id: 'NE.IMP.GNFS.ZS', name: 'Imports of goods and services', keywords: ['imports', 'trade', 'international'] },
  { id: 'BX.KLT.DINV.WD.GD.ZS', name: 'Foreign direct investment', keywords: ['fdi', 'investment', 'foreign', 'capital'] },
  { id: 'IT.NET.USER.ZS', name: 'Individuals using the Internet', keywords: ['internet', 'digital', 'online', 'technology'] },
]

// Common countries for quick links
const MAJOR_COUNTRIES = [
  { code: 'USA', name: 'United States' },
  { code: 'CHN', name: 'China' },
  { code: 'JPN', name: 'Japan' },
  { code: 'DEU', name: 'Germany' },
  { code: 'GBR', name: 'United Kingdom' },
  { code: 'IND', name: 'India' },
  { code: 'FRA', name: 'France' },
  { code: 'BRA', name: 'Brazil' },
  { code: 'CAN', name: 'Canada' },
  { code: 'AUS', name: 'Australia' },
]

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
      const queryLower = query.toLowerCase()
      const queryTerms = queryLower.split(/\s+/)

      // Score indicators by relevance
      const scoredIndicators = POPULAR_INDICATORS
        .map(ind => {
          let score = 0
          const nameLower = ind.name.toLowerCase()

          queryTerms.forEach(term => {
            if (nameLower.includes(term)) score += 3
            if (ind.keywords.some(k => k.includes(term))) score += 2
          })

          return { indicator: ind, score }
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.min(limit, 5))

      // Add matched indicators
      for (let i = 0; i < scoredIndicators.length; i++) {
        const ind = scoredIndicators[i].indicator
        results.push({
          id: generateId(),
          title: ind.name,
          description: `World Bank development indicator. ID: ${ind.id}`,
          url: `https://data.worldbank.org/indicator/${ind.id}`,
          source: 'worldbank' as const,
          category: 'research' as const,
          score: 0.85 - (i * 0.02),
          metadata: {
            indicatorId: ind.id,
            keywords: ind.keywords,
          },
          favicon: 'https://www.worldbank.org/favicon.ico',
        })
      }

      // Check if query matches a country
      const matchedCountry = MAJOR_COUNTRIES.find(c =>
        c.name.toLowerCase().includes(queryLower) ||
        c.code.toLowerCase() === queryLower
      )

      if (matchedCountry) {
        results.push({
          id: generateId(),
          title: `${matchedCountry.name} - Economic Data`,
          description: `World Bank data and statistics for ${matchedCountry.name}.`,
          url: `https://data.worldbank.org/country/${matchedCountry.code}`,
          source: 'worldbank' as const,
          category: 'research' as const,
          score: 0.9,
          metadata: {
            countryCode: matchedCountry.code,
            countryName: matchedCountry.name,
          },
          favicon: 'https://www.worldbank.org/favicon.ico',
        })
      }

      // Add World Bank data search link
      results.push({
        id: generateId(),
        title: `World Bank Data Search: "${query}"`,
        description: 'Search World Bank Open Data for indicators, countries, and topics.',
        url: `https://data.worldbank.org/search?q=${encodeURIComponent(query)}`,
        source: 'worldbank' as const,
        category: 'research' as const,
        score: 0.75,
        metadata: { type: 'search_link' },
        favicon: 'https://www.worldbank.org/favicon.ico',
      })

      // Add topic links for relevant queries
      const topicKeywords: Record<string, string> = {
        'poverty': 'poverty',
        'health': 'health',
        'education': 'education',
        'climate': 'climate-change',
        'environment': 'environment',
        'trade': 'trade',
        'agriculture': 'agriculture',
        'energy': 'energy',
        'urban': 'urban-development',
        'infrastructure': 'infrastructure',
      }

      for (const [keyword, topic] of Object.entries(topicKeywords)) {
        if (queryTerms.includes(keyword)) {
          results.push({
            id: generateId(),
            title: `World Bank: ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Data`,
            description: `Data and research on ${keyword} from the World Bank.`,
            url: `https://data.worldbank.org/topic/${topic}`,
            source: 'worldbank' as const,
            category: 'research' as const,
            score: 0.7,
            metadata: { type: 'topic_link', topic },
            favicon: 'https://www.worldbank.org/favicon.ico',
          })
          break // Only add one topic link
        }
      }

      return results.slice(0, limit)
    } catch (error) {
      console.error('World Bank search error:', error)

      // Fallback
      return [{
        id: generateId(),
        title: `World Bank Data Search: "${query}"`,
        description: 'Search World Bank Open Data for development indicators.',
        url: `https://data.worldbank.org/search?q=${encodeURIComponent(query)}`,
        source: 'worldbank' as const,
        category: 'research' as const,
        score: 0.7,
        favicon: 'https://www.worldbank.org/favicon.ico',
      }]
    }
  },
}

// Get specific indicator data via API
export async function getIndicatorData(
  indicatorId: string,
  countryCode = 'all',
  dateRange = '2010:2023'
): Promise<unknown[]> {
  try {
    const url = `https://api.worldbank.org/v2/country/${countryCode}/indicator/${indicatorId}?format=json&date=${dateRange}&per_page=100`

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) return []

    const data = await response.json()
    return Array.isArray(data) && data[1] ? data[1] : []
  } catch {
    return []
  }
}
