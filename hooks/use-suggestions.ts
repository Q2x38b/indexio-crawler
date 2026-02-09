'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface Suggestion {
  text: string
  type: 'completion' | 'related' | 'refinement' | 'operator' | 'trending'
  confidence: number
  intent?: string
}

interface SuggestionsResponse {
  suggestions: Suggestion[]
  query: string
  intent?: {
    type: string
    confidence: number
  }
  timing: number
}

interface UseSuggestionsOptions {
  debounceMs?: number
  minChars?: number
  maxSuggestions?: number
  useAI?: boolean
}

export function useSuggestions(options: UseSuggestionsOptions = {}) {
  const {
    debounceMs = 150,
    minChars = 1,
    maxSuggestions = 8,
    useAI = false,
  } = options

  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [intent, setIntent] = useState<{ type: string; confidence: number } | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (q.length < minChars) {
      setSuggestions([])
      setIntent(null)
      return
    }

    setIsLoading(true)
    abortControllerRef.current = new AbortController()

    try {
      const params = new URLSearchParams({
        q,
        limit: String(maxSuggestions),
        ...(useAI && { ai: 'true' }),
      })

      const response = await fetch(`/api/suggestions?${params}`, {
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) throw new Error('Failed to fetch suggestions')

      const data: SuggestionsResponse = await response.json()
      setSuggestions(data.suggestions)
      setIntent(data.intent || null)
      setSelectedIndex(-1)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Suggestions error:', error)
        setSuggestions([])
      }
    } finally {
      setIsLoading(false)
    }
  }, [minChars, maxSuggestions, useAI])

  // Debounced query update
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newQuery)
    }, debounceMs)
  }, [debounceMs, fetchSuggestions])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (suggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Tab':
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          e.preventDefault()
          return suggestions[selectedIndex].text
        }
        break
      case 'Escape':
        setSuggestions([])
        setSelectedIndex(-1)
        break
    }

    return null
  }, [suggestions, selectedIndex])

  // Select a suggestion
  const selectSuggestion = useCallback((index: number) => {
    if (index >= 0 && index < suggestions.length) {
      const selected = suggestions[index].text
      setQuery(selected)
      setSuggestions([])
      setSelectedIndex(-1)
      return selected
    }
    return null
  }, [suggestions])

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setSelectedIndex(-1)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    query,
    suggestions,
    isLoading,
    selectedIndex,
    intent,
    updateQuery,
    handleKeyDown,
    selectSuggestion,
    clearSuggestions,
    setSelectedIndex,
  }
}
