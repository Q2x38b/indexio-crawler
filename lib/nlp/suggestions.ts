import { classifyIntentLocal } from './intent'
import type { QueryIntent } from '@/lib/sources/types'

interface Suggestion {
  text: string
  type: 'completion' | 'related' | 'refinement' | 'operator'
  confidence: number
  intent?: QueryIntent['type']
}

// Common query patterns and their completions
const queryPatterns: Record<string, string[]> = {
  // Tech patterns
  'how to': ['install', 'use', 'fix', 'configure', 'deploy', 'build', 'create', 'setup'],
  'what is': ['the difference between', 'the best', 'a good', 'the purpose of', 'the meaning of'],
  'why does': ['my code', 'this error', 'the program', 'javascript', 'python', 'react'],
  'error': ['message', 'handling', 'in javascript', 'in python', 'fix', 'undefined', 'null'],
  'react': ['hooks', 'component', 'useEffect', 'useState', 'context', 'router', 'typescript'],
  'python': ['tutorial', 'list', 'dictionary', 'pandas', 'numpy', 'function', 'class'],
  'javascript': ['array', 'object', 'async await', 'promise', 'function', 'class', 'es6'],
  'api': ['endpoint', 'documentation', 'authentication', 'rest', 'graphql', 'rate limit'],
  'docker': ['compose', 'container', 'image', 'build', 'run', 'volume', 'network'],
  'git': ['commit', 'push', 'pull', 'merge', 'rebase', 'branch', 'checkout', 'reset'],

  // OSINT patterns
  'whois': ['lookup', 'domain', 'ip', 'history', 'privacy'],
  'ip': ['address', 'lookup', 'geolocation', 'reputation', 'range', 'block'],
  'cve': ['2024', '2025', 'critical', 'vulnerability', 'exploit', 'patch'],
  'domain': ['lookup', 'history', 'dns', 'ssl', 'expiration', 'owner'],

  // Research patterns
  'research': ['paper', 'study', 'methodology', 'findings', 'data'],
  'study': ['on', 'about', 'shows', 'finds', 'results'],
  'statistics': ['on', 'about', 'data', 'graph', 'chart'],
}

// Operator suggestions
const operators = [
  { prefix: 'site:', description: 'Search within a specific domain' },
  { prefix: 'filetype:', description: 'Search for specific file types' },
  { prefix: 'intitle:', description: 'Search in page titles' },
  { prefix: '@', description: 'Search for username across platforms' },
  { prefix: 'ip:', description: 'Lookup IP address information' },
  { prefix: 'domain:', description: 'Get domain/WHOIS information' },
  { prefix: 'cve:', description: 'Search for CVE vulnerabilities' },
  { prefix: 'doi:', description: 'Lookup academic paper by DOI' },
]

// Intent-specific refinements
const intentRefinements: Record<string, string[]> = {
  tech: ['tutorial', 'example', 'documentation', 'best practices', 'vs', 'alternative'],
  security: ['exploit', 'patch', 'mitigation', 'affected versions', 'proof of concept'],
  research: ['pdf', 'citation', 'methodology', 'results', 'data', 'peer reviewed'],
  company: ['stock', 'revenue', 'employees', 'founded', 'headquarters', 'ceo'],
  person: ['biography', 'net worth', 'career', 'social media', 'contact'],
  domain: ['history', 'owner', 'dns records', 'ssl certificate', 'archive'],
  ip: ['geolocation', 'isp', 'reputation', 'abuse reports', 'asn'],
  username: ['twitter', 'github', 'linkedin', 'reddit', 'instagram'],
}

/**
 * Generate query suggestions using NLP
 */
export function generateSuggestions(
  query: string,
  limit = 8
): Suggestion[] {
  if (!query || query.length < 2) {
    return getOperatorSuggestions()
  }

  const suggestions: Suggestion[] = []
  const queryLower = query.toLowerCase().trim()
  const words = queryLower.split(/\s+/)
  const lastWord = words[words.length - 1]
  const queryWithoutLast = words.slice(0, -1).join(' ')

  // Detect query intent
  const intent = classifyIntentLocal(query)

  // 1. Pattern-based completions
  for (const [pattern, completions] of Object.entries(queryPatterns)) {
    if (queryLower.includes(pattern) || pattern.startsWith(queryLower)) {
      for (const completion of completions) {
        if (completion.startsWith(lastWord) || lastWord.length < 2) {
          const suggestionText = queryLower.endsWith(' ')
            ? `${query}${completion}`
            : `${queryWithoutLast} ${completion}`.trim()

          suggestions.push({
            text: suggestionText,
            type: 'completion',
            confidence: 0.8,
            intent: intent.type,
          })
        }
      }
    }
  }

  // 2. Intent-based refinements
  const refinements = intentRefinements[intent.type] || intentRefinements.tech
  for (const refinement of refinements) {
    if (!queryLower.includes(refinement)) {
      suggestions.push({
        text: `${query} ${refinement}`,
        type: 'refinement',
        confidence: 0.7,
        intent: intent.type,
      })
    }
  }

  // 3. Related queries based on intent
  const relatedQueries = generateRelatedQueries(query, intent)
  suggestions.push(...relatedQueries)

  // 4. Operator suggestions if query starts with special char
  if (query.startsWith('@') || query.startsWith('ip:') || query.startsWith('site:')) {
    suggestions.unshift(...getContextualOperatorSuggestions(query))
  }

  // Deduplicate and sort by confidence
  const seen = new Set<string>()
  const unique = suggestions.filter(s => {
    const key = s.text.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return unique
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
}

/**
 * Generate suggestions using OpenAI (when available)
 */
export async function generateSuggestionsWithAI(
  query: string,
  limit = 8
): Promise<Suggestion[]> {
  const apiKey = process.env.OPENAI_API_KEY

  // Fall back to local suggestions if no API key
  if (!apiKey) {
    return generateSuggestions(query, limit)
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a search query suggestion engine. Given a partial search query, generate relevant completions and related searches.

Consider these query types:
- Technical (programming, software, APIs)
- OSINT (domains, IPs, usernames, security)
- Research (academic papers, statistics, data)
- General knowledge

Return JSON array of suggestions:
[{"text": "completed query", "type": "completion|related|refinement", "confidence": 0.0-1.0}]

Generate 6-8 diverse, useful suggestions. Prioritize completions over related queries.`
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    })

    if (!response.ok) {
      return generateSuggestions(query, limit)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return generateSuggestions(query, limit)
    }

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(jsonStr) as Suggestion[]

    return parsed.slice(0, limit)
  } catch (error) {
    console.error('AI suggestions error:', error)
    return generateSuggestions(query, limit)
  }
}

/**
 * Generate related queries based on intent
 */
function generateRelatedQueries(query: string, intent: QueryIntent): Suggestion[] {
  const suggestions: Suggestion[] = []
  const queryLower = query.toLowerCase()

  // Tech-related expansions
  if (intent.type === 'tech') {
    const techTerms = ['best practices', 'alternatives to', 'vs', 'performance', 'security']
    for (const term of techTerms.slice(0, 2)) {
      suggestions.push({
        text: `${query} ${term}`,
        type: 'related',
        confidence: 0.6,
        intent: 'tech',
      })
    }
  }

  // OSINT expansions
  if (intent.type === 'domain' || intent.type === 'ip') {
    suggestions.push({
      text: `${query} vulnerabilities`,
      type: 'related',
      confidence: 0.65,
      intent: 'security',
    })
  }

  // Research expansions
  if (intent.type === 'research') {
    suggestions.push({
      text: `${query} recent studies`,
      type: 'related',
      confidence: 0.65,
      intent: 'research',
    })
    suggestions.push({
      text: `${query} statistics 2024`,
      type: 'related',
      confidence: 0.6,
      intent: 'research',
    })
  }

  return suggestions
}

/**
 * Get operator suggestions for empty/short queries
 */
function getOperatorSuggestions(): Suggestion[] {
  return operators.slice(0, 4).map(op => ({
    text: op.prefix,
    type: 'operator' as const,
    confidence: 0.9,
  }))
}

/**
 * Get contextual operator suggestions
 */
function getContextualOperatorSuggestions(query: string): Suggestion[] {
  const suggestions: Suggestion[] = []

  if (query.startsWith('@')) {
    const username = query.slice(1)
    suggestions.push({
      text: `@${username}`,
      type: 'operator',
      confidence: 0.95,
      intent: 'username',
    })
  }

  if (query.startsWith('ip:')) {
    suggestions.push({
      text: query,
      type: 'operator',
      confidence: 0.95,
      intent: 'ip',
    })
  }

  return suggestions
}

/**
 * Get trending/popular queries (can be enhanced with analytics)
 */
export function getTrendingQueries(): string[] {
  return [
    'react 19 new features',
    'openai api tutorial',
    'nextjs 15 migration',
    'tailwind css v4',
    'rust vs go 2024',
    'kubernetes best practices',
    'CVE-2024 critical vulnerabilities',
    'machine learning basics',
  ]
}
