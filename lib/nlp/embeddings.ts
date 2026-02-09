import type { SearchResult } from '@/lib/sources/types'

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  return magnitude === 0 ? 0 : dotProduct / magnitude
}

/**
 * Get embeddings from OpenAI
 */
export async function getEmbeddings(texts: string[]): Promise<number[][] | null> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return null
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
      }),
    })

    if (!response.ok) {
      console.error('OpenAI embeddings error:', response.status)
      return null
    }

    const data = await response.json()
    return data.data?.map((item: { embedding: number[] }) => item.embedding) || null
  } catch (error) {
    console.error('Embeddings error:', error)
    return null
  }
}

/**
 * Re-rank results using semantic similarity
 */
export async function rerankWithEmbeddings(
  query: string,
  results: SearchResult[]
): Promise<SearchResult[]> {
  if (results.length === 0) return results

  // Prepare texts for embedding
  const texts = [
    query,
    ...results.map(r => `${r.title} ${r.description}`)
  ]

  const embeddings = await getEmbeddings(texts)

  if (!embeddings || embeddings.length < 2) {
    return results
  }

  const queryEmbedding = embeddings[0]
  const resultEmbeddings = embeddings.slice(1)

  // Calculate similarity scores
  const scored = results.map((result, i) => ({
    result,
    similarity: cosineSimilarity(queryEmbedding, resultEmbeddings[i]),
  }))

  // Combine with original score
  const reranked = scored.map(({ result, similarity }) => ({
    ...result,
    score: (result.score || 0.5) * 0.4 + similarity * 0.6,
  }))

  // Sort by combined score
  return reranked.sort((a, b) => (b.score || 0) - (a.score || 0))
}

/**
 * Simple TF-IDF based similarity (no API needed)
 */
export function localSimilarity(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/)
  const textTerms = text.toLowerCase().split(/\s+/)
  const textSet = new Set(textTerms)

  let matches = 0
  for (const term of queryTerms) {
    if (textSet.has(term)) {
      matches++
    }
    // Partial matching for longer terms
    for (const textTerm of textTerms) {
      if (textTerm.includes(term) || term.includes(textTerm)) {
        matches += 0.5
        break
      }
    }
  }

  return matches / Math.max(queryTerms.length, 1)
}

/**
 * Re-rank results using local similarity (fast, no API)
 */
export function rerankWithLocalSimilarity(
  query: string,
  results: SearchResult[]
): SearchResult[] {
  if (results.length === 0) return results

  const scored = results.map(result => {
    const textToMatch = `${result.title} ${result.description}`
    const similarity = localSimilarity(query, textToMatch)

    return {
      ...result,
      score: (result.score || 0.5) * 0.5 + similarity * 0.5,
    }
  })

  return scored.sort((a, b) => (b.score || 0) - (a.score || 0))
}
