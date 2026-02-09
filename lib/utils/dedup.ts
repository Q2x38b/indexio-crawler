import type { SearchResult } from '@/lib/sources/types'

/**
 * Normalize a URL for comparison (remove trailing slashes, www, protocol variations)
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`
  } catch {
    return url.toLowerCase()
  }
}

/**
 * Normalize text for comparison (lowercase, remove extra whitespace)
 */
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Calculate Jaccard similarity between two strings
 */
function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/))
  const setB = new Set(b.toLowerCase().split(/\s+/))

  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])

  return intersection.size / union.size
}

/**
 * Check if two results are duplicates
 */
function areDuplicates(a: SearchResult, b: SearchResult): boolean {
  // Same URL = definite duplicate
  if (normalizeUrl(a.url) === normalizeUrl(b.url)) {
    return true
  }

  // Very similar titles from same source = likely duplicate
  if (a.source === b.source) {
    const titleSimilarity = jaccardSimilarity(a.title, b.title)
    if (titleSimilarity > 0.8) {
      return true
    }
  }

  // Exact same title and similar description = likely duplicate
  if (normalizeText(a.title) === normalizeText(b.title)) {
    const descSimilarity = jaccardSimilarity(a.description, b.description)
    if (descSimilarity > 0.6) {
      return true
    }
  }

  return false
}

/**
 * Deduplicate search results, keeping the highest scored version
 */
export function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const deduplicated: SearchResult[] = []

  for (const result of results) {
    const existingIndex = deduplicated.findIndex(r => areDuplicates(r, result))

    if (existingIndex === -1) {
      deduplicated.push(result)
    } else {
      // Keep the one with higher score, or the one with more description
      const existing = deduplicated[existingIndex]
      const existingScore = existing.score ?? 0
      const newScore = result.score ?? 0

      if (newScore > existingScore ||
          (newScore === existingScore && result.description.length > existing.description.length)) {
        deduplicated[existingIndex] = result
      }
    }
  }

  return deduplicated
}

/**
 * Merge results from multiple sources, deduplicating and sorting
 */
export function mergeResults(resultsBySource: SearchResult[][]): SearchResult[] {
  const allResults = resultsBySource.flat()
  const deduplicated = deduplicateResults(allResults)

  // Sort by score (descending), then by timestamp (most recent first)
  return deduplicated.sort((a, b) => {
    const scoreA = a.score ?? 0
    const scoreB = b.score ?? 0

    if (scoreA !== scoreB) {
      return scoreB - scoreA
    }

    if (a.timestamp && b.timestamp) {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    }

    return 0
  })
}
