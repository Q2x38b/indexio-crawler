'use client'

import * as React from 'react'
import type { SearchResult, SearchResponse, CategoryType } from '@/lib/sources/types'
import { debounce } from '@/lib/utils'

interface UseSearchOptions {
  debounceMs?: number
  autoSearch?: boolean
}

interface UseSearchReturn {
  query: string
  setQuery: (query: string) => void
  results: SearchResult[]
  isLoading: boolean
  error: string | null
  search: () => Promise<void>
  response: SearchResponse | null
  category: CategoryType
  setCategory: (category: CategoryType) => void
  clear: () => void
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { debounceMs = 0, autoSearch = false } = options

  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState<CategoryType>('all')
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [response, setResponse] = React.useState<SearchResponse | null>(null)

  const abortControllerRef = React.useRef<AbortController | null>(null)

  const search = React.useCallback(async () => {
    if (!query.trim()) return

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        categories: category,
        limit: '30',
      })

      const res = await fetch(`/api/search?${params}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`)
      }

      const data: SearchResponse = await res.json()

      setResults(data.results)
      setResponse(data)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // Ignore abort errors
      }
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [query, category])

  // Debounced auto-search
  const debouncedSearch = React.useMemo(
    () => debounce(() => search(), debounceMs),
    [search, debounceMs]
  )

  React.useEffect(() => {
    if (autoSearch && query.trim().length >= 2) {
      debouncedSearch()
    }
  }, [autoSearch, query, debouncedSearch])

  // Clear state
  const clear = React.useCallback(() => {
    setQuery('')
    setResults([])
    setResponse(null)
    setError(null)
  }, [])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    search,
    response,
    category,
    setCategory,
    clear,
  }
}
