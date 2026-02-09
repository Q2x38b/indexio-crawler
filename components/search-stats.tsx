'use client'

import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { QueryIntent } from '@/lib/sources/types'

interface SearchStatsProps {
  resultCount: number
  timing: number
  sourcesQueried: number
  sourcesSucceeded: number
  intent?: QueryIntent
  className?: string
}

export function SearchStats({
  resultCount,
  timing,
  sourcesQueried,
  sourcesSucceeded,
  intent,
  className,
}: SearchStatsProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 text-sm text-muted-foreground', className)}>
      <span>
        <strong className="text-foreground">{resultCount}</strong> results
      </span>
      <span className="text-muted-foreground/50">·</span>
      <span>
        <strong className="text-foreground">{timing}ms</strong>
      </span>
      <span className="text-muted-foreground/50">·</span>
      <span>
        <strong className="text-foreground">{sourcesSucceeded}</strong>/{sourcesQueried} sources
      </span>

      {intent && intent.type !== 'general' && (
        <>
          <span className="text-muted-foreground/50">·</span>
          <Badge variant="secondary" className="text-xs capitalize">
            {intent.type}
            {intent.confidence >= 0.8 && (
              <span className="ml-1 opacity-70">
                {Math.round(intent.confidence * 100)}%
              </span>
            )}
          </Badge>
        </>
      )}

      {intent?.entities && intent.entities.length > 0 && (
        <>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-xs">
            Detected:{' '}
            {intent.entities.slice(0, 2).map((entity, i) => (
              <code key={entity} className="px-1 py-0.5 bg-muted rounded text-xs">
                {entity}
                {i < Math.min(intent.entities.length - 1, 1) ? ', ' : ''}
              </code>
            ))}
          </span>
        </>
      )}
    </div>
  )
}

// Inline intent indicator
export function IntentIndicator({ intent }: { intent: QueryIntent }) {
  const intentConfig: Record<string, { color: string; icon: string }> = {
    general: { color: 'bg-gray-100 text-gray-700', icon: '🌐' },
    tech: { color: 'bg-blue-100 text-blue-700', icon: '💻' },
    security: { color: 'bg-red-100 text-red-700', icon: '🔒' },
    domain: { color: 'bg-teal-100 text-teal-700', icon: '🌍' },
    company: { color: 'bg-purple-100 text-purple-700', icon: '🏢' },
    person: { color: 'bg-green-100 text-green-700', icon: '👤' },
    research: { color: 'bg-amber-100 text-amber-700', icon: '📚' },
  }

  const config = intentConfig[intent.type] || intentConfig.general

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        config.color
      )}
    >
      <span>{config.icon}</span>
      <span className="capitalize">{intent.type}</span>
    </span>
  )
}
