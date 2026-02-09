import type { SourceAdapter, SourceType, CategoryType, SearchResult } from './types'
import { categorySourceMap } from './types'
import { wikipediaAdapter } from './wikipedia'
import { githubAdapter } from './github'
import { hackernewsAdapter } from './hackernews'
import { redditAdapter } from './reddit'
import { stackoverflowAdapter } from './stackoverflow'
import { arxivAdapter } from './arxiv'
import { cveAdapter } from './cve'
import { whoisAdapter } from './whois'
import { companiesAdapter } from './companies'
import { devtoAdapter } from './devto'
import { npmAdapter, pypiAdapter } from './npm'
import { archiveAdapter } from './archive'
import { duckduckgoAdapter } from './duckduckgo'
import { googleCSEAdapter } from './google-cse'
import { worldBankAdapter } from './worldbank'
import { whoAdapter } from './who'
import { censusAdapter } from './census'
import { usernameAdapter } from './username'
import { ipgeoAdapter } from './ipgeo'
import { crossrefAdapter } from './crossref'
import { parallelFetch } from '@/lib/utils/fetcher'
import { mergeResults } from '@/lib/utils/dedup'

// Registry of all source adapters
export const sourceAdapters: Record<SourceType, SourceAdapter> = {
  // Web & Knowledge
  wikipedia: wikipediaAdapter,
  wikidata: wikipediaAdapter, // Use same adapter with wikidata mode
  duckduckgo: duckduckgoAdapter,
  googlecse: googleCSEAdapter,
  archive: archiveAdapter,
  // Code & Development
  github: githubAdapter,
  stackoverflow: stackoverflowAdapter,
  devto: devtoAdapter,
  lobsters: devtoAdapter, // Similar format
  npm: npmAdapter,
  pypi: pypiAdapter,
  // News & Social
  hackernews: hackernewsAdapter,
  reddit: redditAdapter,
  news: hackernewsAdapter, // Use HN as news source
  // OSINT & Security
  whois: whoisAdapter,
  dns: whoisAdapter, // DNS is handled in whois adapter
  cve: cveAdapter,
  company: companiesAdapter,
  sec: companiesAdapter, // SEC is part of companies adapter
  username: usernameAdapter,
  ipgeo: ipgeoAdapter,
  // Research & Academic
  arxiv: arxivAdapter,
  pubmed: arxivAdapter, // Similar API pattern
  crossref: crossrefAdapter,
  worldbank: worldBankAdapter,
  who: whoAdapter,
  census: censusAdapter,
}

// Get sources for a category
export function getSourcesForCategory(category: CategoryType): SourceType[] {
  if (category === 'all') {
    return Object.keys(sourceAdapters) as SourceType[]
  }
  return categorySourceMap[category] || []
}

// Search options
export interface SearchOptions {
  query: string
  categories?: CategoryType[]
  sources?: SourceType[]
  limit?: number
  timeout?: number
}

/**
 * Search all enabled sources in parallel
 */
export async function searchAllSources(options: SearchOptions): Promise<{
  results: SearchResult[]
  timing: number
  sourcesQueried: number
  sourcesSucceeded: number
}> {
  const {
    query,
    categories = ['all'],
    sources,
    limit = 10,
    timeout = 5000,
  } = options

  const startTime = Date.now()

  // Determine which sources to query
  let sourcesToQuery: SourceType[]

  if (sources && sources.length > 0) {
    sourcesToQuery = sources
  } else if (categories.includes('all')) {
    sourcesToQuery = Object.keys(sourceAdapters) as SourceType[]
  } else {
    sourcesToQuery = [...new Set(categories.flatMap(cat => getSourcesForCategory(cat)))]
  }

  // Filter to enabled sources only
  sourcesToQuery = sourcesToQuery.filter(
    source => sourceAdapters[source]?.config.enabled
  )

  // Create fetchers for each source
  const fetchers = sourcesToQuery.map(source => ({
    name: source,
    fn: async () => {
      try {
        const adapter = sourceAdapters[source]
        return await adapter.search(query, limit)
      } catch (error) {
        console.error(`Error searching ${source}:`, error)
        return []
      }
    },
  }))

  // Execute all searches in parallel with individual timeouts
  const fetchResults = await parallelFetch<SearchResult[]>(fetchers, { timeout })

  // Collect successful results
  const allResults: SearchResult[][] = []
  let sourcesSucceeded = 0

  for (const result of fetchResults) {
    if (result.data && result.data.length > 0) {
      allResults.push(result.data)
      sourcesSucceeded++
    }
  }

  // Merge and deduplicate results
  const mergedResults = mergeResults(allResults)

  return {
    results: mergedResults.slice(0, limit * 5), // Return more results for client-side filtering
    timing: Date.now() - startTime,
    sourcesQueried: sourcesToQuery.length,
    sourcesSucceeded,
  }
}

/**
 * Search specific sources
 */
export async function searchSources(
  sources: SourceType[],
  query: string,
  limit = 10
): Promise<SearchResult[]> {
  const result = await searchAllSources({
    query,
    sources,
    limit,
  })

  return result.results
}

/**
 * Get a single source adapter
 */
export function getSourceAdapter(source: SourceType): SourceAdapter | null {
  return sourceAdapters[source] || null
}

/**
 * Get all enabled source names
 */
export function getEnabledSources(): SourceType[] {
  return (Object.keys(sourceAdapters) as SourceType[]).filter(
    source => sourceAdapters[source]?.config.enabled
  )
}

/**
 * Count total sources
 */
export function getTotalSourceCount(): number {
  return Object.keys(sourceAdapters).length
}

// Re-export types
export * from './types'
