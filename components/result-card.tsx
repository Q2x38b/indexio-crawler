'use client'

import * as React from 'react'
import { ExternalLink, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate, extractDomain, truncate } from '@/lib/utils'
import { sourceMetadata, type SearchResult } from '@/lib/sources/types'

interface ResultCardProps {
  result: SearchResult
  index: number
  isSelected?: boolean
  onSelect?: () => void
}

export function ResultCard({
  result,
  index,
  isSelected = false,
  onSelect,
}: ResultCardProps) {
  const meta = sourceMetadata[result.source]

  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onSelect}
      className={cn(
        'block p-4 rounded-lg border transition-all duration-200',
        'hover:bg-accent/50 hover:border-accent-foreground/20',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        isSelected && 'bg-accent border-primary'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Source badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={cn(
                'inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold',
                meta?.color || 'bg-muted text-muted-foreground'
              )}
            >
              {meta?.icon || result.source.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-xs text-muted-foreground">
              {extractDomain(result.url)}
            </span>
            {result.timestamp && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDate(result.timestamp)}
                </span>
              </>
            )}
          </div>

          {/* Title */}
          <h3 className="font-medium text-foreground leading-tight mb-1 line-clamp-2">
            {result.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2">
            {result.description}
          </p>

          {/* Metadata tags */}
          {result.metadata && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.metadata.language && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {result.metadata.language as string}
                </Badge>
              )}
              {result.metadata.stars !== undefined && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {(result.metadata.stars as number).toLocaleString()} stars
                </Badge>
              )}
              {result.metadata.points !== undefined && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {result.metadata.points as number} pts
                </Badge>
              )}
              {result.metadata.severity && (
                <Badge
                  variant={
                    (result.metadata.severity as string) === 'CRITICAL' ||
                    (result.metadata.severity as string) === 'HIGH'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="text-[10px] px-1.5 py-0"
                >
                  {result.metadata.severity as string}
                </Badge>
              )}
              {result.metadata.tags && Array.isArray(result.metadata.tags) && (
                <>
                  {(result.metadata.tags as string[]).slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Score indicator */}
        {result.score !== undefined && (
          <div className="flex-shrink-0 flex flex-col items-end gap-1">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                result.score >= 0.8
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : result.score >= 0.6
                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {Math.round(result.score * 100)}
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
    </a>
  )
}

// Keyboard navigation index display
export function ResultIndex({ index }: { index: number }) {
  return (
    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs text-muted-foreground font-mono">
      {index + 1}
    </span>
  )
}
