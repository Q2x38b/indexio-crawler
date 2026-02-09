import { NextRequest, NextResponse } from 'next/server'
import { getSourceAdapter, type SourceType } from '@/lib/sources'

export const runtime = 'edge'

// GET /api/sources/[source]?q=query - Search a specific source
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string }> }
) {
  const startTime = Date.now()
  const { source: sourceParam } = await params

  try {
    const source = sourceParam as SourceType
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 10

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      )
    }

    const adapter = getSourceAdapter(source)

    if (!adapter) {
      return NextResponse.json(
        { error: `Unknown source: ${source}` },
        { status: 404 }
      )
    }

    if (!adapter.config.enabled) {
      return NextResponse.json(
        { error: `Source "${source}" is currently disabled` },
        { status: 503 }
      )
    }

    const results = await adapter.search(query, limit)

    return NextResponse.json({
      source,
      query,
      results,
      count: results.length,
      timing: Date.now() - startTime,
    })
  } catch (error) {
    console.error(`Source search error (${sourceParam}):`, error)

    return NextResponse.json(
      {
        error: 'Search failed',
        source: sourceParam,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
