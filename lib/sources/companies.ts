import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout, buildUrl } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

interface OpenCorporatesResponse {
  results?: {
    companies?: Array<{
      company: {
        name: string
        company_number: string
        jurisdiction_code: string
        incorporation_date?: string
        dissolution_date?: string
        company_type?: string
        registry_url?: string
        opencorporates_url: string
        current_status?: string
        registered_address_in_full?: string
      }
    }>
  }
}

interface SECCompany {
  cik: string
  name: string
  ticker?: string
  exchange?: string
}

export const companiesAdapter: SourceAdapter = {
  config: {
    name: 'Companies',
    source: 'company',
    category: 'osint',
    enabled: true,
    timeout: 5000,
  },

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    // Run both searches in parallel
    const [openCorporates, sec] = await Promise.allSettled([
      searchOpenCorporates(query, Math.ceil(limit / 2)),
      searchSEC(query, Math.ceil(limit / 2)),
    ])

    const results: SearchResult[] = []

    if (openCorporates.status === 'fulfilled') {
      results.push(...openCorporates.value)
    }

    if (sec.status === 'fulfilled') {
      results.push(...sec.value)
    }

    return results.slice(0, limit)
  },
}

/**
 * Search OpenCorporates API
 */
async function searchOpenCorporates(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const url = buildUrl('https://api.opencorporates.com/v0.4/companies/search', {
      q: query,
      per_page: limit,
    })

    const data = await fetchWithTimeout<OpenCorporatesResponse>(url, {
      timeout: 4000,
    })

    if (!data.results?.companies) {
      return []
    }

    return data.results.companies.map(item => {
      const company = item.company

      return {
        id: generateId(),
        title: company.name,
        description: truncate(
          [
            `${company.jurisdiction_code.toUpperCase()} #${company.company_number}`,
            company.company_type,
            company.current_status,
            company.incorporation_date ? `Inc: ${company.incorporation_date}` : null,
            company.registered_address_in_full?.slice(0, 50),
          ].filter(Boolean).join(' | '),
          300
        ),
        url: company.opencorporates_url,
        source: 'company' as const,
        category: 'osint' as const,
        timestamp: company.incorporation_date,
        score: 0.75,
        metadata: {
          companyNumber: company.company_number,
          jurisdiction: company.jurisdiction_code,
          status: company.current_status,
          type: company.company_type,
          registryUrl: company.registry_url,
        },
        favicon: 'https://opencorporates.com/assets/favicon.ico',
      }
    })
  } catch (error) {
    console.error('OpenCorporates search error:', error)
    return []
  }
}

/**
 * Search SEC EDGAR for US companies
 */
async function searchSEC(query: string, limit: number): Promise<SearchResult[]> {
  try {
    // SEC full-text search endpoint
    const url = buildUrl('https://efts.sec.gov/LATEST/search-index', {
      q: query,
      dateRange: 'custom',
      startdt: '2020-01-01',
      enddt: new Date().toISOString().split('T')[0],
      forms: 'DEF 14A,10-K,10-Q,8-K',
    })

    // SEC doesn't have a great public company search API
    // Use the company tickers file instead
    const tickersUrl = 'https://www.sec.gov/files/company_tickers.json'

    const data = await fetchWithTimeout<Record<string, SECCompany>>(tickersUrl, {
      timeout: 4000,
    })

    const queryLower = query.toLowerCase()
    const matches = Object.values(data)
      .filter(company =>
        company.name.toLowerCase().includes(queryLower) ||
        company.ticker?.toLowerCase().includes(queryLower)
      )
      .slice(0, limit)

    return matches.map(company => ({
      id: generateId(),
      title: company.name,
      description: truncate(
        [
          company.ticker ? `Ticker: ${company.ticker}` : null,
          company.exchange ? `Exchange: ${company.exchange}` : null,
          `CIK: ${company.cik}`,
        ].filter(Boolean).join(' | '),
        300
      ),
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${company.cik}&type=&dateb=&owner=include&count=40`,
      source: 'sec' as const,
      category: 'osint' as const,
      score: 0.8,
      metadata: {
        cik: company.cik,
        ticker: company.ticker,
        exchange: company.exchange,
      },
      favicon: 'https://www.sec.gov/favicon.ico',
    }))
  } catch (error) {
    console.error('SEC search error:', error)
    return []
  }
}

/**
 * Get company filings from SEC EDGAR
 */
export async function getCompanyFilings(cik: string, limit = 10): Promise<SearchResult[]> {
  try {
    const paddedCik = cik.padStart(10, '0')
    const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`

    const data = await fetchWithTimeout<{
      name: string
      filings: {
        recent: {
          accessionNumber: string[]
          filingDate: string[]
          form: string[]
          primaryDocument: string[]
        }
      }
    }>(url, { timeout: 4000 })

    const { recent } = data.filings
    const results: SearchResult[] = []

    for (let i = 0; i < Math.min(limit, recent.accessionNumber.length); i++) {
      const accession = recent.accessionNumber[i].replace(/-/g, '')
      results.push({
        id: generateId(),
        title: `${data.name} - ${recent.form[i]}`,
        description: `Filing date: ${recent.filingDate[i]}`,
        url: `https://www.sec.gov/Archives/edgar/data/${paddedCik}/${accession}/${recent.primaryDocument[i]}`,
        source: 'sec' as const,
        category: 'osint' as const,
        timestamp: recent.filingDate[i],
        score: 0.75,
      })
    }

    return results
  } catch {
    return []
  }
}
