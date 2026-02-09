'use client'

import * as React from 'react'
import { Moon, Sun, Zap, Github } from 'lucide-react'
import { SearchBar } from '@/components/search-bar'
import { ResultGrid, EmptyState } from '@/components/result-grid'
import { CategoryFilter } from '@/components/category-filter'
import { SearchStats } from '@/components/search-stats'
import { Button } from '@/components/ui/button'
import { useSearch } from '@/hooks/use-search'
import { useKeyboardNavigation, useTheme } from '@/hooks/use-keyboard'

export default function HomePage() {
  const { theme, toggle: toggleTheme } = useTheme()
  const {
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
  } = useSearch()

  const { selectedIndex, setSelectedIndex } = useKeyboardNavigation({
    itemCount: results.length,
    enabled: results.length > 0,
    onEnter: (index) => {
      const result = results[index]
      if (result) {
        window.open(result.url, '_blank')
      }
    },
  })

  const hasSearched = response !== null
  const showResults = hasSearched && results.length > 0

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">Indexio</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-5 w-5" />
            </a>
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 container px-4 py-8">
        {/* Hero section (shown when no search) */}
        {!hasSearched && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="h-12 w-12 text-primary" />
              <h1 className="text-4xl font-bold tracking-tight">Indexio</h1>
            </div>
            <p className="text-xl text-muted-foreground text-center mb-8 max-w-lg">
              Search across 20+ data sources with AI-powered understanding.
              Wikipedia, GitHub, CVEs, WHOIS, and more.
            </p>
          </div>
        )}

        {/* Search section */}
        <div className={`flex flex-col items-center gap-6 ${hasSearched ? 'mb-8' : ''}`}>
          <SearchBar
            value={query}
            onChange={setQuery}
            onSearch={search}
            isLoading={isLoading}
            autoFocus={!hasSearched}
            placeholder="Search anything... (domains, CVEs, people, code, research)"
          />

          {/* Category filter */}
          <div className="w-full max-w-2xl">
            <CategoryFilter
              value={category}
              onChange={(cat) => {
                setCategory(cat)
                if (query.trim()) {
                  setTimeout(search, 100)
                }
              }}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-center">
            {error}
          </div>
        )}

        {/* Results section */}
        <div className="max-w-3xl mx-auto">
          {/* Stats */}
          {showResults && response && (
            <SearchStats
              resultCount={results.length}
              timing={response.timing}
              sourcesQueried={response.totalSources}
              sourcesSucceeded={response.successfulSources}
              intent={response.intent}
              className="mb-4"
            />
          )}

          {/* Results grid */}
          {isLoading ? (
            <ResultGrid results={[]} isLoading={true} />
          ) : showResults ? (
            <ResultGrid
              results={results}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
            />
          ) : hasSearched ? (
            <EmptyState query={query} />
          ) : null}

          {/* Keyboard shortcuts hint */}
          {showResults && (
            <div className="mt-6 pt-6 border-t flex justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">j</kbd>
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">k</kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">Enter</kbd>
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">g</kbd>
                first
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono">G</kbd>
                last
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 px-4">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Indexio - Aggregate search powered by 20+ free data sources</p>
          <div className="flex items-center gap-4">
            <span>Wikipedia</span>
            <span>GitHub</span>
            <span>HN</span>
            <span>Reddit</span>
            <span>CVE</span>
            <span>+15 more</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
