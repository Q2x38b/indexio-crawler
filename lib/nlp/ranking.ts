import type { SearchResult, QueryIntent, SourceType } from '@/lib/sources/types'
import { rerankWithEmbeddings, rerankWithLocalSimilarity } from './embeddings'

// Source trust scores (higher = more authoritative)
const sourceTrustScores: Record<SourceType, number> = {
  // Web & Knowledge
  wikipedia: 0.95,
  wikidata: 0.9,
  duckduckgo: 0.75,
  googlecse: 0.9,
  archive: 0.8,
  // Code & Development
  github: 0.85,
  stackoverflow: 0.85,
  devto: 0.75,
  lobsters: 0.7,
  npm: 0.8,
  pypi: 0.8,
  // News & Social
  hackernews: 0.7,
  reddit: 0.6,
  news: 0.7,
  // OSINT & Security
  whois: 0.9,
  dns: 0.9,
  cve: 0.95,
  company: 0.85,
  sec: 0.95,
  username: 0.7,
  ipgeo: 0.85,
  // Research & Academic
  arxiv: 0.95,
  pubmed: 0.95,
  crossref: 0.95,
  worldbank: 0.9,
  who: 0.95,
  census: 0.9,
}

// Default relevance scores for all sources
const defaultRelevance: Record<SourceType, number> = {
  wikipedia: 0.5, wikidata: 0.5, duckduckgo: 0.5, googlecse: 0.5, archive: 0.4,
  github: 0.4, stackoverflow: 0.4, devto: 0.4, lobsters: 0.4, npm: 0.3, pypi: 0.3,
  hackernews: 0.4, reddit: 0.4, news: 0.4,
  whois: 0.3, dns: 0.3, cve: 0.3, company: 0.4, sec: 0.3, username: 0.3, ipgeo: 0.3,
  arxiv: 0.4, pubmed: 0.4, crossref: 0.4, worldbank: 0.4, who: 0.4, census: 0.4,
}

// Intent-source relevance (how well a source matches an intent)
const intentSourceRelevance: Record<string, Partial<Record<SourceType, number>>> = {
  general: {
    googlecse: 1.0, wikipedia: 0.95, duckduckgo: 0.9, hackernews: 0.7, reddit: 0.6,
    wikidata: 0.8, archive: 0.5, news: 0.6, devto: 0.5, lobsters: 0.5,
  },
  tech: {
    github: 1.0, stackoverflow: 1.0, npm: 0.9, pypi: 0.9, devto: 0.85,
    hackernews: 0.8, lobsters: 0.8, googlecse: 0.7, wikipedia: 0.6, reddit: 0.7,
  },
  security: {
    cve: 1.0, ipgeo: 0.9, github: 0.8, whois: 0.7, dns: 0.7,
    hackernews: 0.7, reddit: 0.6, googlecse: 0.6, archive: 0.5, lobsters: 0.6,
  },
  domain: {
    whois: 1.0, dns: 1.0, archive: 0.9, ipgeo: 0.7, cve: 0.5,
    googlecse: 0.5, company: 0.4, sec: 0.3,
  },
  company: {
    company: 1.0, sec: 1.0, wikipedia: 0.8, googlecse: 0.8, news: 0.8,
    hackernews: 0.7, reddit: 0.6, wikidata: 0.7, worldbank: 0.5, archive: 0.5,
  },
  person: {
    wikipedia: 1.0, wikidata: 0.9, username: 0.9, googlecse: 0.8,
    reddit: 0.7, hackernews: 0.6, github: 0.6, news: 0.7,
  },
  research: {
    arxiv: 1.0, pubmed: 1.0, crossref: 1.0, worldbank: 0.9, who: 0.9, census: 0.9,
    wikipedia: 0.8, wikidata: 0.7, googlecse: 0.6,
  },
  ip: {
    ipgeo: 1.0, whois: 0.8, dns: 0.8, cve: 0.5,
  },
  username: {
    username: 1.0, github: 0.9, reddit: 0.8, hackernews: 0.7,
    devto: 0.6, googlecse: 0.5,
  },
  doi: {
    crossref: 1.0, arxiv: 0.9, pubmed: 0.9, googlecse: 0.5,
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
  const intentRelevanceMap = intentSourceRelevance[intent.type] || {}
  const intentRelevance = intentRelevanceMap[result.source] ?? defaultRelevance[result.source] ?? 0.5

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
