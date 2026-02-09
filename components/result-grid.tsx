'use client'

import * as React from 'react'
import { ResultCard } from './result-card'
import { Skeleton } from '@/components/ui/skeleton'
import type { SearchResult } from '@/lib/sources/types'

interface ResultGridProps {
  results: SearchResult[]
  isLoading?: boolean
  selectedIndex?: number
  onSelectIndex?: (index: number) => void
}

export function ResultGrid({
  results,
  isLoading = false,
  selectedIndex = -1,
  onSelectIndex,
}: ResultGridProps) {
  if (isLoading) {
    return <ResultGridSkeleton />
  }

  if (results.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      {results.map((result, index) => (
        <ResultCard
          key={result.id}
          result={result}
          index={index}
          isSelected={index === selectedIndex}
          onSelect={() => onSelectIndex?.(index)}
        />
      ))}
    </div>
  )
}

function ResultGridSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="p-4 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="w-24 h-3" />
            <Skeleton className="w-16 h-3" />
          </div>
          <Skeleton className="w-3/4 h-5 mb-2" />
          <Skeleton className="w-full h-4" />
          <Skeleton className="w-2/3 h-4 mt-1" />
        </div>
      ))}
    </div>
  )
}

// Empty state component
export function EmptyState({ query }: { query?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <span className="text-2xl">🔍</span>
      </div>
      {query ? (
        <>
          <h3 className="text-lg font-medium mb-2">No results found</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            We couldn&apos;t find any results for &quot;{query}&quot;. Try different keywords
            or check your spelling.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium mb-2">Start searching</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Search across 20+ data sources including Wikipedia, GitHub, Hacker News,
            CVE databases, and more.
          </p>
        </>
      )}
    </div>
  )
}
