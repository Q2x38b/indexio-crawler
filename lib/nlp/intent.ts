import type { QueryIntent, SourceType } from '@/lib/sources/types'
import { intentSourceMap } from '@/lib/sources/types'
import { isDomain, isIPAddress } from '@/lib/utils'

// Intent patterns for local classification (no API needed)
const intentPatterns = {
  domain: [
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/,
    /\.(com|net|org|io|dev|app|co|ai|xyz|info|biz|gov|edu|uk|de|fr|jp)$/i,
  ],
  ip: [
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
  ],
  username: [
    /^@?[a-zA-Z][a-zA-Z0-9_]{2,30}$/,
    /\b(username|user|profile|account|who\s+is\s+@)\b/i,
    /^@[a-zA-Z0-9_]+$/,
  ],
  doi: [
    /^10\.\d{4,}\/[^\s]+$/,
    /doi\.org\/10\./i,
    /\b(doi|citation|cite|paper\s+id)\b/i,
  ],
  security: [
    /\b(cve|vulnerability|exploit|malware|attack|breach|hack)\b/i,
    /\b(security|pentest|penetration|bug\s*bounty|threat)\b/i,
    /CVE-\d{4}-\d+/i,
    /\b(ransomware|phishing|ddos|botnet|rootkit)\b/i,
  ],
  company: [
    /\b(company|corporation|corp|inc|llc|ltd|gmbh|plc|s\.?a\.?)\b/i,
    /\b(stock|ticker|sec|filing|investor|quarterly|earnings)\b/i,
    /\b(founded|ceo|revenue|valuation|acquisition|ipo|market\s*cap)\b/i,
  ],
  person: [
    /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,
    /\b(who\s+is|biography|born|died|age\s+of)\b/i,
    /\b(founder|ceo|president|director|author|inventor)\b/i,
  ],
  tech: [
    /\b(programming|code|coding|developer|software|api|sdk|cli)\b/i,
    /\b(javascript|typescript|python|rust|golang|java|c\+\+|ruby)\b/i,
    /\b(react|vue|angular|nextjs|svelte|tailwind|bootstrap)\b/i,
    /\b(npm|pip|cargo|package|library|framework|tutorial|docs)\b/i,
    /\b(github|stackoverflow|documentation|how\s+to)\b/i,
    /\b(bug|error|exception|debug|fix|issue)\b/i,
  ],
  research: [
    /\b(research|paper|study|journal|academic|scientific|scholar)\b/i,
    /\b(arxiv|pubmed|doi|citation|thesis|dissertation)\b/i,
    /\b(hypothesis|methodology|findings|results|experiment)\b/i,
    /\b(health|disease|medicine|vaccine|treatment|clinical)\b/i,
    /\b(gdp|economy|population|census|statistics|data)\b/i,
  ],
}

/**
 * Classify query intent locally (fast, no API call)
 */
export function classifyIntentLocal(query: string): QueryIntent {
  const queryLower = query.toLowerCase().trim()
  const entities: string[] = []

  // Check for IP address first (most specific)
  if (isIPAddress(query)) {
    return {
      type: 'ip',
      confidence: 0.98,
      entities: [query],
      suggestedSources: intentSourceMap.ip,
    }
  }

  // Check for domain pattern
  if (isDomain(query)) {
    return {
      type: 'domain',
      confidence: 0.95,
      entities: [query],
      suggestedSources: intentSourceMap.domain,
    }
  }

  // Check for CVE pattern
  const cveMatch = query.match(/CVE-\d{4}-\d+/i)
  if (cveMatch) {
    return {
      type: 'security',
      confidence: 0.98,
      entities: [cveMatch[0].toUpperCase()],
      suggestedSources: intentSourceMap.security,
    }
  }

  // Check for DOI pattern
  const doiMatch = query.match(/10\.\d{4,}\/[^\s]+/) || query.match(/doi\.org\/(10\.[^\s]+)/i)
  if (doiMatch) {
    return {
      type: 'doi',
      confidence: 0.98,
      entities: [doiMatch[1] || doiMatch[0]],
      suggestedSources: intentSourceMap.doi,
    }
  }

  // Check for username pattern (starts with @)
  if (query.startsWith('@') && /^@[a-zA-Z0-9_]{2,30}$/.test(query)) {
    return {
      type: 'username',
      confidence: 0.95,
      entities: [query.replace('@', '')],
      suggestedSources: intentSourceMap.username,
    }
  }

  // Score each intent type
  const scores: Record<string, number> = {}

  for (const [intentType, patterns] of Object.entries(intentPatterns)) {
    let score = 0
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        score += 1
      }
    }
    if (score > 0) {
      scores[intentType] = score / patterns.length
    }
  }

  // Find highest scoring intent
  const sortedIntents = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])

  if (sortedIntents.length > 0 && sortedIntents[0][1] > 0.2) {
    const [type, confidence] = sortedIntents[0]
    const intentType = type as QueryIntent['type']
    return {
      type: intentType,
      confidence: Math.min(confidence + 0.3, 0.9),
      entities,
      suggestedSources: intentSourceMap[intentType] || intentSourceMap.general,
    }
  }

  // Default to general
  return {
    type: 'general',
    confidence: 0.5,
    entities: [],
    suggestedSources: intentSourceMap.general,
  }
}

/**
 * Enhanced intent classification using OpenAI (optional)
 */
export async function classifyIntentWithAI(query: string): Promise<QueryIntent> {
  const apiKey = process.env.OPENAI_API_KEY

  // Fallback to local classification if no API key
  if (!apiKey) {
    return classifyIntentLocal(query)
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
            content: `You are a query intent classifier. Classify the user's search query into one of these types:
- general: General knowledge questions
- person: Looking for information about a specific person
- company: Looking for company/business information
- domain: Looking up a website or domain
- tech: Programming, code, software related
- security: Security vulnerabilities, CVEs, exploits
- research: Academic, scientific, health, economic research
- ip: IP address lookup
- username: Social media username lookup
- doi: DOI/citation/paper lookup

Respond with JSON only: {"type": "...", "confidence": 0.0-1.0, "entities": ["extracted entities"], "reason": "brief explanation"}`
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.1,
        max_tokens: 150,
      }),
    })

    if (!response.ok) {
      return classifyIntentLocal(query)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return classifyIntentLocal(query)
    }

    const parsed = JSON.parse(content)
    const intentType = (parsed.type || 'general') as QueryIntent['type']

    return {
      type: intentType,
      confidence: parsed.confidence || 0.7,
      entities: parsed.entities || [],
      suggestedSources: intentSourceMap[intentType] || intentSourceMap.general,
    }
  } catch (error) {
    console.error('AI intent classification error:', error)
    return classifyIntentLocal(query)
  }
}

/**
 * Expand query with synonyms/related terms
 */
export function expandQuery(query: string): string[] {
  const expansions: string[] = [query]

  // Add common programming synonyms
  const synonyms: Record<string, string[]> = {
    'js': ['javascript'],
    'ts': ['typescript'],
    'py': ['python'],
    'react': ['reactjs', 'react.js'],
    'vue': ['vuejs', 'vue.js'],
    'node': ['nodejs', 'node.js'],
    'next': ['nextjs', 'next.js'],
    'api': ['rest api', 'http api'],
    'ml': ['machine learning'],
    'ai': ['artificial intelligence'],
    'db': ['database'],
    'sql': ['mysql', 'postgresql', 'database'],
    'k8s': ['kubernetes'],
    'docker': ['container', 'containerization'],
    'aws': ['amazon web services'],
    'gcp': ['google cloud platform'],
    'azure': ['microsoft azure'],
  }

  for (const [term, syns] of Object.entries(synonyms)) {
    if (query.toLowerCase().includes(term)) {
      for (const syn of syns) {
        expansions.push(query.toLowerCase().replace(term, syn))
      }
    }
  }

  return [...new Set(expansions)]
}

/**
 * Detect if query looks like a username
 */
export function isUsernameQuery(query: string): boolean {
  // Starts with @
  if (query.startsWith('@')) return true
  // Single word, alphanumeric with underscores, reasonable length
  if (/^[a-zA-Z][a-zA-Z0-9_]{2,30}$/.test(query) && !query.includes(' ')) {
    // Avoid common words
    const commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out']
    return !commonWords.includes(query.toLowerCase())
  }
  return false
}

/**
 * Detect if query is a DOI
 */
export function isDOI(query: string): boolean {
  return /^10\.\d{4,}\//.test(query) || query.includes('doi.org/10.')
}
