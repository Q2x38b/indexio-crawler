import { NextRequest, NextResponse } from 'next/server'
import { generateSuggestions, generateSuggestionsWithAI, getTrendingQueries } from '@/lib/nlp/suggestions'
import { classifyIntentLocal } from '@/lib/nlp/intent'

export const runtime = 'edge'

// GET /api/suggestions?q=query&ai=true
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''
    const useAI = searchParams.get('ai') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '8', 10), 15)

    // Return trending queries for empty input
    if (!query || query.length < 1) {
      return NextResponse.json({
        suggestions: getTrendingQueries().slice(0, limit).map(text => ({
          text,
          type: 'trending',
          confidence: 0.8,
        })),
        query: '',
        intent: null,
        timing: Date.now() - startTime,
      })
    }

    // Get intent for context
    const intent = classifyIntentLocal(query)

    // Generate suggestions
    const suggestions = useAI && process.env.OPENAI_API_KEY
      ? await generateSuggestionsWithAI(query, limit)
      : generateSuggestions(query, limit)

    return NextResponse.json({
      suggestions,
      query,
      intent: {
        type: intent.type,
        confidence: intent.confidence,
      },
      timing: Date.now() - startTime,
    })
  } catch (error) {
    console.error('Suggestions error:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
