import { NextRequest, NextResponse } from 'next/server'
import { searchAllSources, type SearchOptions } from '@/lib/sources'
import { classifyIntentLocal, classifyIntentWithAI } from '@/lib/nlp/intent'
import { fullRankingPipeline, diversifyResults } from '@/lib/nlp/ranking'
import { cache, createCacheKey } from '@/lib/utils/cache'
import type { SearchResponse, CategoryType, SourceType } from '@/lib/sources/types'

export const runtime = 'edge'
export const preferredRegion = 'auto'

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    // Parse optional parameters
    const categoriesParam = searchParams.get('categories')
    const sourcesParam = searchParams.get('sources')
    const limitParam = searchParams.get('limit')
    const useAI = searchParams.get('ai') === 'true'

    const categories = categoriesParam
      ? (categoriesParam.split(',') as CategoryType[])
      : ['all' as CategoryType]

    const sources = sourcesParam
      ? (sourcesParam.split(',') as SourceType[])
      : undefined

    const limit = limitParam ? parseInt(limitParam, 10) : 30

    // Check cache
    const cacheKey = createCacheKey('search', { query, categories, sources, limit })
    const cached = cache.get<SearchResponse>(cacheKey)

    if (cached) {
      return NextResponse.json({
        ...cached,
        cached: true,
        timing: Date.now() - startTime,
      })
    }

    // Classify intent (AI or local)
    const intent = useAI
      ? await classifyIntentWithAI(query)
      : classifyIntentLocal(query)

    // Search all sources - don't filter by intent, query everything for comprehensive results
    const searchOptions: SearchOptions = {
      query,
      categories,
      sources, // Only use explicit sources if provided, otherwise search ALL sources
      limit,
      timeout: 6000, // Increased timeout for slower APIs
    }

    const searchResult = await searchAllSources(searchOptions)

    // Rank and diversify results
    const ranked = await fullRankingPipeline(
      query,
      searchResult.results,
      intent,
      useAI // Use embeddings if AI mode is enabled
    )

    const diversified = diversifyResults(ranked, 5)

    const response: SearchResponse = {
      results: diversified.slice(0, limit),
      query,
      intent,
      totalSources: searchResult.sourcesQueried,
      successfulSources: searchResult.sourcesSucceeded,
      timing: Date.now() - startTime,
    }

    // Cache for 5 minutes
    cache.set(cacheKey, response, 5 * 60 * 1000)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Search error:', error)

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timing: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { query, categories, sources, limit = 30, useAI = false } = body

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    const intent = useAI
      ? await classifyIntentWithAI(query)
      : classifyIntentLocal(query)

    const searchResult = await searchAllSources({
      query,
      categories,
      sources, // Only use explicit sources if provided, otherwise search ALL sources
      limit,
      timeout: 6000, // Increased timeout for slower APIs
    })

    const ranked = await fullRankingPipeline(query, searchResult.results, intent, useAI)
    const diversified = diversifyResults(ranked, 5)

    return NextResponse.json({
      results: diversified.slice(0, limit),
      query,
      intent,
      totalSources: searchResult.sourcesQueried,
      successfulSources: searchResult.sourcesSucceeded,
      timing: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Search error:', error)

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
