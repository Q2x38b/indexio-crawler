import type { QueryIntent, SourceType } from '@/lib/sources/types'
import { isDomain, isIPAddress } from '@/lib/utils'

// Intent patterns for local classification (no API needed)
const intentPatterns = {
  domain: [
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/,
    /\.(com|net|org|io|dev|app|co|ai|xyz|info|biz|gov|edu)$/i,
  ],
  ip: [
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
  ],
  security: [
    /\b(cve|vulnerability|exploit|malware|attack|breach|hack)\b/i,
    /\b(security|pentest|penetration|bug\s*bounty)\b/i,
    /CVE-\d{4}-\d+/i,
  ],
  company: [
    /\b(company|corporation|corp|inc|llc|ltd|gmbh|plc)\b/i,
    /\b(stock|ticker|sec|filing|investor|quarterly)\b/i,
    /\b(founded|ceo|revenue|valuation|acquisition)\b/i,
  ],
  person: [
    /^[A-Z][a-z]+\s+[A-Z][a-z]+$/,
    /\b(who\s+is|biography|born|died|age\s+of)\b/i,
    /\b(founder|ceo|president|director|author)\b/i,
  ],
  tech: [
    /\b(programming|code|coding|developer|software|api|sdk)\b/i,
    /\b(javascript|typescript|python|rust|golang|react|vue|angular)\b/i,
    /\b(npm|pip|package|library|framework|tutorial|docs)\b/i,
    /\b(github|stackoverflow|documentation)\b/i,
  ],
  research: [
    /\b(research|paper|study|journal|academic|scientific)\b/i,
    /\b(arxiv|pubmed|doi|citation|thesis|dissertation)\b/i,
    /\b(hypothesis|methodology|findings|results)\b/i,
  ],
}

// Source recommendations based on intent
const intentSourceMap: Record<string, SourceType[]> = {
  domain: ['whois', 'archive', 'cve'],
  ip: ['whois'],
  security: ['cve', 'github', 'hackernews'],
  company: ['company', 'wikipedia', 'hackernews', 'reddit'],
  person: ['wikipedia', 'reddit', 'hackernews'],
  tech: ['github', 'stackoverflow', 'npm', 'pypi', 'devto', 'hackernews'],
  research: ['arxiv', 'wikipedia'],
  general: ['wikipedia', 'duckduckgo', 'hackernews', 'reddit', 'github'],
}

/**
 * Classify query intent locally (fast, no API call)
 */
export function classifyIntentLocal(query: string): QueryIntent {
  const queryLower = query.toLowerCase().trim()
  const entities: string[] = []

  // Check for domain pattern
  if (isDomain(query)) {
    return {
      type: 'domain',
      confidence: 0.95,
      entities: [query],
      suggestedSources: intentSourceMap.domain,
    }
  }

  // Check for IP address
  if (isIPAddress(query)) {
    return {
      type: 'domain',
      confidence: 0.95,
      entities: [query],
      suggestedSources: intentSourceMap.ip,
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

  if (sortedIntents.length > 0 && sortedIntents[0][1] > 0.3) {
    const [type, confidence] = sortedIntents[0]
    return {
      type: type as QueryIntent['type'],
      confidence: Math.min(confidence + 0.3, 0.9),
      entities,
      suggestedSources: intentSourceMap[type] || intentSourceMap.general,
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
- research: Academic, scientific research

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

    return {
      type: parsed.type || 'general',
      confidence: parsed.confidence || 0.7,
      entities: parsed.entities || [],
      suggestedSources: intentSourceMap[parsed.type] || intentSourceMap.general,
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
    'api': ['rest api', 'http api'],
    'ml': ['machine learning'],
    'ai': ['artificial intelligence'],
    'db': ['database'],
    'sql': ['mysql', 'postgresql', 'database'],
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
