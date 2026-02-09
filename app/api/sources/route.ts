import { NextRequest, NextResponse } from 'next/server'
import { sourceAdapters, getSourcesForCategory } from '@/lib/sources'
import { sourceMetadata, type CategoryType, type SourceType } from '@/lib/sources/types'

export const runtime = 'edge'

// GET /api/sources - List all available sources
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') as CategoryType | null

  const allSources = Object.entries(sourceAdapters).map(([key, adapter]) => ({
    id: key as SourceType,
    ...sourceMetadata[key as SourceType],
    category: adapter.config.category,
    enabled: adapter.config.enabled,
    timeout: adapter.config.timeout,
  }))

  if (category && category !== 'all') {
    const categorySourceIds = getSourcesForCategory(category)
    const filteredSources = allSources.filter(s => categorySourceIds.includes(s.id))
    return NextResponse.json({ sources: filteredSources, category })
  }

  return NextResponse.json({ sources: allSources })
}
