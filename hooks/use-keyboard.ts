'use client'

import * as React from 'react'

interface UseKeyboardNavigationOptions {
  itemCount: number
  onSelect?: (index: number) => void
  onEnter?: (index: number) => void
  enabled?: boolean
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onEnter,
  enabled = true,
}: UseKeyboardNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = React.useState(-1)

  React.useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if focus is on input/textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => {
            const next = Math.min(prev + 1, itemCount - 1)
            onSelect?.(next)
            return next
          })
          break

        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => {
            const next = Math.max(prev - 1, 0)
            onSelect?.(next)
            return next
          })
          break

        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < itemCount) {
            e.preventDefault()
            onEnter?.(selectedIndex)
          }
          break

        case 'g':
          e.preventDefault()
          setSelectedIndex(0)
          onSelect?.(0)
          break

        case 'G':
          e.preventDefault()
          const last = itemCount - 1
          setSelectedIndex(last)
          onSelect?.(last)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, itemCount, selectedIndex, onSelect, onEnter])

  // Reset when item count changes
  React.useEffect(() => {
    setSelectedIndex(-1)
  }, [itemCount])

  return {
    selectedIndex,
    setSelectedIndex,
  }
}

// Hook for theme toggle
export function useTheme() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light')

  React.useEffect(() => {
    // Check initial theme
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    const initial = stored === 'dark' || (!stored && prefersDark) ? 'dark' : 'light'
    setTheme(initial)
    document.documentElement.classList.toggle('dark', initial === 'dark')
  }, [])

  const toggle = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      localStorage.setItem('theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      return next
    })
  }, [])

  return { theme, toggle }
}
