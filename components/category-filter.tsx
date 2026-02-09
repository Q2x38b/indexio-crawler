'use client'

import * as React from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import type { CategoryType } from '@/lib/sources/types'

interface CategoryFilterProps {
  value: CategoryType
  onChange: (category: CategoryType) => void
  disabled?: boolean
  className?: string
}

const categories: { value: CategoryType; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: '🌐' },
  { value: 'web', label: 'Web', icon: '📖' },
  { value: 'code', label: 'Code', icon: '💻' },
  { value: 'osint', label: 'OSINT', icon: '🔍' },
  { value: 'research', label: 'Research', icon: '📚' },
  { value: 'news', label: 'News', icon: '📰' },
]

export function CategoryFilter({
  value,
  onChange,
  disabled = false,
  className,
}: CategoryFilterProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as CategoryType)}
      className={cn('w-full', className)}
    >
      <TabsList className="w-full justify-start gap-1 h-auto flex-wrap bg-transparent p-0">
        {categories.map((category) => (
          <TabsTrigger
            key={category.value}
            value={category.value}
            disabled={disabled}
            className={cn(
              'px-3 py-1.5 rounded-full border text-sm',
              'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
              'data-[state=active]:border-primary',
              'data-[state=inactive]:bg-transparent data-[state=inactive]:border-border',
              'hover:bg-accent hover:text-accent-foreground transition-colors'
            )}
          >
            <span className="mr-1.5">{category.icon}</span>
            {category.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

// Compact version for mobile
export function CategoryFilterCompact({
  value,
  onChange,
  disabled = false,
}: CategoryFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CategoryType)}
      disabled={disabled}
      className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {categories.map((category) => (
        <option key={category.value} value={category.value}>
          {category.icon} {category.label}
        </option>
      ))}
    </select>
  )
}
