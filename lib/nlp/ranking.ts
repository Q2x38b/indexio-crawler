import type { SearchResult, QueryIntent, SourceType } from '@/lib/sources/types'
import { rerankWithEmbeddings, rerankWithLocalSimilarity } from './embeddings'

// Source trust scores (higher = more authoritative)
const sourceTrustScores: Record<SourceType, number> = {
  wikipedia: 0.95,
  wikidata: 0.9,
  arxiv: 0.95,
  pubmed: 0.95,
  github: 0.85,
  stackoverflow: 0.85,
  hackernews: 0.7,
  reddit: 0.6,
  devto: 0.75,
  lobsters: 0.7,
  npm: 0.8,
  pypi: 0.8,
  cve: 0.95,
  whois: 0.9,
  dns: 0.9,
  company: 0.85,
  sec: 0.95,
  archive: 0.8,
  duckduckgo: 0.75,
  news: 0.7,
}

// Intent-source relevance (how well a source matches an intent)
const intentSourceRelevance: Record<string, Record<SourceType, number>> = {
  general: {
    wikipedia: 1.0, duckduckgo: 0.9, hackernews: 0.7, reddit: 0.6,
    github: 0.5, stackoverflow: 0.4, arxiv: 0.4, devto: 0.5,
    npm: 0.3, pypi: 0.3, cve: 0.2, whois: 0.2, dns: 0.2,
    company: 0.4, sec: 0.3, archive: 0.5, lobsters: 0.5,
    wikidata: 0.8, pubmed: 0.4, news: 0.6,
  },
  tech: {
    github: 1.0, stackoverflow: 1.0, npm: 0.9, pypi: 0.9,
    devto: 0.85, hackernews: 0.8, lobsters: 0.8, wikipedia: 0.6,
    reddit: 0.7, arxiv: 0.5, duckduckgo: 0.5, archive: 0.4,
    cve: 0.3, whois: 0.2, dns: 0.2, company: 0.3, sec: 0.2,
    wikidata: 0.5, pubmed: 0.3, news: 0.4,
  },
  security: {
    cve: 1.0, github: 0.8, hackernews: 0.7, reddit: 0.6,
    stackoverflow: 0.5, whois: 0.6, dns: 0.5, archive: 0.5,
    wikipedia: 0.4, duckduckgo: 0.4, devto: 0.5, npm: 0.4,
    pypi: 0.4, company: 0.3, sec: 0.3, arxiv: 0.4, lobsters: 0.6,
    wikidata: 0.3, pubmed: 0.2, news: 0.5,
  },
  domain: {
    whois: 1.0, dns: 1.0, archive: 0.9, cve: 0.5,
    wikipedia: 0.3, duckduckgo: 0.4, hackernews: 0.3, reddit: 0.3,
    github: 0.2, stackoverflow: 0.2, devto: 0.2, npm: 0.1,
    pypi: 0.1, company: 0.4, sec: 0.3, arxiv: 0.1, lobsters: 0.2,
    wikidata: 0.3, pubmed: 0.1, news: 0.3,
  },
  company: {
    company: 1.0, sec: 1.0, wikipedia: 0.8, hackernews: 0.7,
    reddit: 0.6, duckduckgo: 0.6, github: 0.4, archive: 0.5,
    whois: 0.4, cve: 0.2, stackoverflow: 0.2, devto: 0.3,
    npm: 0.2, pypi: 0.2, arxiv: 0.2, lobsters: 0.4, dns: 0.3,
    wikidata: 0.7, pubmed: 0.2, news: 0.7,
  },
  person: {
    wikipedia: 1.0, wikidata: 0.9, reddit: 0.7, hackernews: 0.6,
    duckduckgo: 0.7, github: 0.5, devto: 0.4, company: 0.4,
    sec: 0.3, archive: 0.5, stackoverflow: 0.3, arxiv: 0.4,
    npm: 0.2, pypi: 0.2, cve: 0.1, whois: 0.2, dns: 0.1,
    lobsters: 0.4, pubmed: 0.5, news: 0.7,
  },
  research: {
    arxiv: 1.0, pubmed: 1.0, wikipedia: 0.8, wikidata: 0.7,
    github: 0.5, duckduckgo: 0.5, hackernews: 0.4, reddit: 0.4,
    stackoverflow: 0.3, devto: 0.3, npm: 0.2, pypi: 0.2,
    cve: 0.2, whois: 0.1, dns: 0.1, company: 0.2, sec: 0.2,
    archive: 0.4, lobsters: 0.3, news: 0.4,
  },
}

/**
 * Calculate final relevance score for a result
 */
function calculateRelevanceScore(
  result: SearchResult,
  intent: QueryIntent
): number {
  const baseScore = result.score || 0.5
  const trustScore = sourceTrustScores[result.source] || 0.5
  const intentRelevance = intentSourceRelevance[intent.type]?.[result.source] || 0.5

  // Combine scores with weights
  const combinedScore = (
    baseScore * 0.4 +           // Original relevance from source
    trustScore * 0.2 +          // Source authority
    intentRelevance * 0.3 +     // Intent-source match
    intent.confidence * 0.1     // Intent confidence boost
  )

  // Boost recent results
  let recencyBoost = 0
  if (result.timestamp) {
    const age = Date.now() - new Date(result.timestamp).getTime()
    const dayMs = 86400000
    if (age < dayMs) recencyBoost = 0.1          // Today
    else if (age < 7 * dayMs) recencyBoost = 0.05 // This week
    else if (age < 30 * dayMs) recencyBoost = 0.02 // This month
  }

  return Math.min(1, combinedScore + recencyBoost)
}

/**
 * Rank results based on intent and multiple signals
 */
export function rankResults(
  results: SearchResult[],
  intent: QueryIntent
): SearchResult[] {
  // Calculate scores for all results
  const scored = results.map(result => ({
    ...result,
    score: calculateRelevanceScore(result, intent),
  }))

  // Sort by score descending
  return scored.sort((a, b) => (b.score || 0) - (a.score || 0))
}

/**
 * Full ranking pipeline with optional embedding-based re-ranking
 */
export async function fullRankingPipeline(
  query: string,
  results: SearchResult[],
  intent: QueryIntent,
  useEmbeddings = false
): Promise<SearchResult[]> {
  if (results.length === 0) return results

  // First pass: intent-based ranking
  let ranked = rankResults(results, intent)

  // Second pass: semantic re-ranking (if enabled and API key available)
  if (useEmbeddings && process.env.OPENAI_API_KEY) {
    // Only re-rank top 30 to save API calls
    const topResults = ranked.slice(0, 30)
    const rest = ranked.slice(30)

    const reranked = await rerankWithEmbeddings(query, topResults)
    ranked = [...reranked, ...rest]
  } else {
    // Use local similarity for light re-ranking
    ranked = rerankWithLocalSimilarity(query, ranked)
  }

  return ranked
}

/**
 * Group results by source for display
 */
export function groupResultsBySource(
  results: SearchResult[]
): Record<SourceType, SearchResult[]> {
  const groups: Record<string, SearchResult[]> = {}

  for (const result of results) {
    if (!groups[result.source]) {
      groups[result.source] = []
    }
    groups[result.source].push(result)
  }

  return groups as Record<SourceType, SearchResult[]>
}

/**
 * Get diverse results (prevent one source from dominating)
 */
export function diversifyResults(
  results: SearchResult[],
  maxPerSource = 5
): SearchResult[] {
  const counts: Record<string, number> = {}
  const diversified: SearchResult[] = []

  for (const result of results) {
    const count = counts[result.source] || 0
    if (count < maxPerSource) {
      diversified.push(result)
      counts[result.source] = count + 1
    }
  }

  return diversified
}
