import type { SourceAdapter, SourceType, CategoryType, SearchResult } from './types'
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
import { parallelFetch } from '@/lib/utils/fetcher'
import { mergeResults } from '@/lib/utils/dedup'

// Registry of all source adapters
export const sourceAdapters: Record<SourceType, SourceAdapter> = {
  wikipedia: wikipediaAdapter,
  wikidata: wikipediaAdapter, // Use same adapter
  github: githubAdapter,
  hackernews: hackernewsAdapter,
  reddit: redditAdapter,
  stackoverflow: stackoverflowAdapter,
  arxiv: arxivAdapter,
  pubmed: arxivAdapter, // Similar API pattern
  cve: cveAdapter,
  whois: whoisAdapter,
  dns: whoisAdapter, // DNS is handled in whois adapter
  company: companiesAdapter,
  sec: companiesAdapter, // SEC is part of companies adapter
  archive: archiveAdapter,
  devto: devtoAdapter,
  lobsters: hackernewsAdapter, // Similar format
  npm: npmAdapter,
  pypi: pypiAdapter,
  news: hackernewsAdapter, // Use HN as news source
  duckduckgo: duckduckgoAdapter,
}

// Get sources for a category
export function getSourcesForCategory(category: CategoryType): SourceType[] {
  const categoryMap: Record<CategoryType, SourceType[]> = {
    web: ['wikipedia', 'duckduckgo', 'archive'],
    code: ['github', 'stackoverflow', 'devto', 'npm', 'pypi'],
    osint: ['whois', 'cve', 'company', 'archive'],
    research: ['arxiv', 'wikipedia'],
    news: ['hackernews', 'reddit', 'devto'],
    all: Object.keys(sourceAdapters) as SourceType[],
  }

  return categoryMap[category] || categoryMap.all
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
    timeout = 3000,
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
    results: mergedResults.slice(0, limit * 3), // Return more results for client-side filtering
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

// Re-export types
export * from './types'
