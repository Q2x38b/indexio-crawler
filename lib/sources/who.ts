import type { SearchResult, SourceAdapter } from './types'
import { generateId } from '@/lib/utils'

// Pre-defined popular WHO indicators for quick access (avoids fetching 2000+ indicators)
const POPULAR_INDICATORS = [
  { code: 'WHOSIS_000001', name: 'Life expectancy at birth', keywords: ['life expectancy', 'lifespan', 'mortality', 'age'] },
  { code: 'WHOSIS_000002', name: 'Healthy life expectancy at birth', keywords: ['healthy life', 'hale', 'disability-free'] },
  { code: 'MDG_0000000001', name: 'Infant mortality rate', keywords: ['infant', 'baby', 'mortality', 'death', 'child'] },
  { code: 'MDG_0000000007', name: 'Under-five mortality rate', keywords: ['child', 'mortality', 'under 5', 'death'] },
  { code: 'MDG_0000000011', name: 'Maternal mortality ratio', keywords: ['maternal', 'pregnancy', 'birth', 'mother'] },
  { code: 'NCD_BMI_30A', name: 'Obesity prevalence', keywords: ['obesity', 'overweight', 'bmi', 'weight'] },
  { code: 'SA_0000001688', name: 'Alcohol consumption per capita', keywords: ['alcohol', 'drinking', 'consumption'] },
  { code: 'M_Est_smk_curr_std', name: 'Tobacco smoking prevalence', keywords: ['smoking', 'tobacco', 'cigarette'] },
  { code: 'WSH_SANITATION_SAFELY_MANAGED', name: 'Safely managed sanitation', keywords: ['sanitation', 'water', 'hygiene'] },
  { code: 'WHS3_40', name: 'Tuberculosis incidence', keywords: ['tuberculosis', 'tb', 'infectious disease'] },
  { code: 'HIV_0000000001', name: 'HIV prevalence', keywords: ['hiv', 'aids', 'virus', 'infection'] },
  { code: 'MALARIA_EST_INCIDENCE', name: 'Malaria incidence', keywords: ['malaria', 'mosquito', 'parasitic'] },
  { code: 'UHC_INDEX_REPORTED', name: 'Universal health coverage index', keywords: ['healthcare', 'coverage', 'uhc', 'access'] },
  { code: 'NUTRITION_ANAEMIA_CHILDREN_PREV', name: 'Anemia in children', keywords: ['anemia', 'iron', 'nutrition', 'children'] },
  { code: 'NUTRITION_WA_2', name: 'Child stunting', keywords: ['stunting', 'growth', 'nutrition', 'children'] },
  { code: 'NCD_HYP_PREVALENCE_A', name: 'Hypertension prevalence', keywords: ['hypertension', 'blood pressure', 'heart'] },
  { code: 'NCD_GLUC_04', name: 'Diabetes prevalence', keywords: ['diabetes', 'glucose', 'blood sugar'] },
  { code: 'MH_12', name: 'Suicide mortality rate', keywords: ['suicide', 'mental health', 'depression'] },
  { code: 'RS_198', name: 'Hospital beds per 10000', keywords: ['hospital', 'beds', 'healthcare', 'capacity'] },
  { code: 'HWF_0001', name: 'Physicians per 10000', keywords: ['doctors', 'physicians', 'healthcare workers'] },
]

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
      const queryLower = query.toLowerCase()
      const queryTerms = queryLower.split(/\s+/)

      // Score indicators by relevance
      const scored = POPULAR_INDICATORS
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
        .slice(0, Math.min(limit, 6))

      const results: SearchResult[] = scored.map((item, i) => {
        const ind = item.indicator
        return {
          id: generateId(),
          title: ind.name,
          description: `WHO Global Health Observatory indicator. Code: ${ind.code}`,
          url: `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/${ind.code}`,
          source: 'who' as const,
          category: 'research' as const,
          score: 0.85 - (i * 0.02),
          metadata: {
            indicatorCode: ind.code,
            keywords: ind.keywords,
            type: 'health_indicator',
          },
          favicon: 'https://www.who.int/favicon.ico',
        }
      })

      // Add WHO data search link
      results.push({
        id: generateId(),
        title: `WHO Data Search: "${query}"`,
        description: 'Search the WHO Global Health Observatory for health statistics and data.',
        url: `https://www.who.int/data/gho/data/indicators/indicators-index?text=${encodeURIComponent(query)}`,
        source: 'who' as const,
        category: 'research' as const,
        score: 0.75,
        metadata: { type: 'search_link' },
        favicon: 'https://www.who.int/favicon.ico',
      })

      // Add disease-specific links for health queries
      const healthKeywords = ['disease', 'virus', 'outbreak', 'pandemic', 'epidemic', 'health', 'medical', 'covid', 'flu', 'influenza']
      if (queryTerms.some(t => healthKeywords.includes(t))) {
        results.push({
          id: generateId(),
          title: `WHO Disease Outbreak News`,
          description: 'Latest disease outbreak news and health emergencies from WHO.',
          url: `https://www.who.int/emergencies/disease-outbreak-news`,
          source: 'who' as const,
          category: 'research' as const,
          score: 0.7,
          metadata: { type: 'news_link' },
          favicon: 'https://www.who.int/favicon.ico',
        })
      }

      return results.slice(0, limit)
    } catch (error) {
      console.error('WHO search error:', error)

      // Fallback
      return [{
        id: generateId(),
        title: `WHO Data Search: "${query}"`,
        description: 'Search WHO Global Health Observatory for health data.',
        url: `https://www.who.int/data/gho/data/indicators/indicators-index?text=${encodeURIComponent(query)}`,
        source: 'who' as const,
        category: 'research' as const,
        score: 0.7,
        favicon: 'https://www.who.int/favicon.ico',
      }]
    }
  },
}

// Get specific WHO indicator data via API
export async function getIndicatorData(indicatorCode: string, country?: string): Promise<unknown[]> {
  try {
    let url = `https://ghoapi.azureedge.net/api/${indicatorCode}?$top=100`
    if (country) {
      url += `&$filter=SpatialDim eq '${country}'`
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000)
    })

    if (!response.ok) return []

    const data = await response.json()
    return data.value || []
  } catch {
    return []
  }
}
