'use client'

import * as React from 'react'
import { Search, X, Loader2, Sparkles, TrendingUp, ArrowRight, AtSign, Globe, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSuggestions } from '@/hooks/use-suggestions'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query?: string) => void
  isLoading?: boolean
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

const intentIcons: Record<string, React.ReactNode> = {
  username: <AtSign className="h-3 w-3" />,
  domain: <Globe className="h-3 w-3" />,
  ip: <Globe className="h-3 w-3" />,
  research: <FileText className="h-3 w-3" />,
  doi: <FileText className="h-3 w-3" />,
}

export function SearchBar({
  value,
  onChange,
  onSearch,
  isLoading = false,
  placeholder = 'Search anything...',
  autoFocus = false,
  className,
}: SearchBarProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = React.useState(false)

  const {
    suggestions,
    isLoading: suggestionsLoading,
    selectedIndex,
    intent,
    updateQuery,
    handleKeyDown: handleSuggestionKeyDown,
    selectSuggestion,
    clearSuggestions,
    setSelectedIndex,
  } = useSuggestions({ debounceMs: 150, useAI: !!process.env.NEXT_PUBLIC_USE_AI_SUGGESTIONS })

  // Sync value with suggestions hook
  React.useEffect(() => {
    updateQuery(value)
  }, [value, updateQuery])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle suggestion navigation
    const selected = handleSuggestionKeyDown(e)
    if (selected) {
      onChange(selected)
      onSearch(selected)
      return
    }

    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        const selectedText = suggestions[selectedIndex].text
        onChange(selectedText)
        onSearch(selectedText)
        clearSuggestions()
      } else if (value.trim()) {
        onSearch()
        clearSuggestions()
      }
    }
    if (e.key === 'Escape') {
      if (suggestions.length > 0) {
        clearSuggestions()
      } else {
        onChange('')
        inputRef.current?.blur()
      }
    }
  }

  const handleClear = () => {
    onChange('')
    clearSuggestions()
    inputRef.current?.focus()
  }

  const handleSuggestionClick = (index: number) => {
    const selected = selectSuggestion(index)
    if (selected) {
      onChange(selected)
      onSearch(selected)
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    if (value.length >= 1) {
      updateQuery(value)
    }
  }

  const handleBlur = () => {
    // Delay to allow click on suggestions
    setTimeout(() => {
      setIsFocused(false)
      clearSuggestions()
    }, 200)
  }

  // Global keyboard shortcut to focus search
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) ||
        (e.key === 'k' && (e.metaKey || e.ctrlKey))
      ) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const showSuggestions = isFocused && suggestions.length > 0

  return (
    <div className={cn('relative w-full max-w-2xl', className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-4 h-5 w-5 text-muted-foreground pointer-events-none z-10" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={isLoading}
          className={cn(
            'h-14 pl-12 pr-24 text-lg border-2 focus-visible:ring-0 focus-visible:border-primary',
            showSuggestions ? 'rounded-t-xl rounded-b-none border-b-0' : 'rounded-xl'
          )}
        />
        <div className="absolute right-2 flex items-center gap-2 z-10">
          {suggestionsLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {value && !suggestionsLoading && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClear}
              className="h-8 w-8"
              disabled={isLoading}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            onClick={() => onSearch()}
            disabled={!value.trim() || isLoading}
            className="h-10 px-4"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute w-full bg-background border-2 border-t-0 border-input rounded-b-xl shadow-lg z-50 overflow-hidden">
          {intent && intent.confidence > 0.7 && (
            <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>
                Detected: <span className="font-medium text-foreground capitalize">{intent.type}</span> query
              </span>
            </div>
          )}
          <ul className="py-1">
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion.text}-${index}`}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(index)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors',
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted/50'
                  )}
                >
                  {suggestion.type === 'trending' ? (
                    <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : suggestion.type === 'operator' ? (
                    <span className="h-4 w-4 flex items-center justify-center text-xs font-mono text-muted-foreground flex-shrink-0">
                      {intentIcons[suggestion.intent || ''] || <ArrowRight className="h-3 w-3" />}
                    </span>
                  ) : (
                    <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="flex-1 truncate">
                    {highlightMatch(suggestion.text, value)}
                  </span>
                  {suggestion.type === 'refinement' && (
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      refine
                    </span>
                  )}
                  {suggestion.type === 'related' && (
                    <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      related
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 border-t bg-muted/30 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-background rounded font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-background rounded font-mono">Tab</kbd>
              complete
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-background rounded font-mono">Enter</kbd>
              search
            </span>
          </div>
        </div>
      )}

      {!showSuggestions && (
        <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">/</kbd>
            to focus
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">@username</kbd>
            OSINT
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">192.168.x.x</kbd>
            IP lookup
          </span>
        </div>
      )}
    </div>
  )
}

// Highlight matching text in suggestions
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text

  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const index = lowerText.indexOf(lowerQuery)

  if (index === -1) return text

  return (
    <>
      {text.slice(0, index)}
      <span className="font-semibold text-primary">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  )
}
