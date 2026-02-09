export type SourceType =
  | 'wikipedia'
  | 'wikidata'
  | 'github'
  | 'hackernews'
  | 'reddit'
  | 'stackoverflow'
  | 'arxiv'
  | 'pubmed'
  | 'cve'
  | 'whois'
  | 'dns'
  | 'company'
  | 'sec'
  | 'archive'
  | 'devto'
  | 'lobsters'
  | 'npm'
  | 'pypi'
  | 'news'
  | 'duckduckgo'

export type CategoryType =
  | 'web'
  | 'code'
  | 'osint'
  | 'research'
  | 'news'
  | 'all'

export interface SearchResult {
  id: string
  title: string
  description: string
  url: string
  source: SourceType
  category: CategoryType
  timestamp?: string
  score?: number
  metadata?: Record<string, unknown>
  favicon?: string
}

export interface SourceConfig {
  name: string
  source: SourceType
  category: CategoryType
  enabled: boolean
  timeout: number
  rateLimit?: number
}

export interface SearchRequest {
  query: string
  categories?: CategoryType[]
  sources?: SourceType[]
  limit?: number
  offset?: number
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
  intent?: QueryIntent
  totalSources: number
  successfulSources: number
  timing: number
}

export interface QueryIntent {
  type: 'general' | 'person' | 'company' | 'domain' | 'tech' | 'security' | 'research'
  confidence: number
  entities: string[]
  suggestedSources: SourceType[]
}

export interface SourceAdapter {
  config: SourceConfig
  search: (query: string, limit?: number) => Promise<SearchResult[]>
}

// Category to source mapping
export const categorySourceMap: Record<CategoryType, SourceType[]> = {
  web: ['wikipedia', 'wikidata', 'duckduckgo', 'archive'],
  code: ['github', 'stackoverflow', 'devto', 'npm', 'pypi', 'lobsters'],
  osint: ['whois', 'dns', 'cve', 'company', 'sec', 'archive'],
  research: ['arxiv', 'pubmed', 'wikipedia', 'wikidata'],
  news: ['hackernews', 'reddit', 'news', 'devto', 'lobsters'],
  all: [],
}

// Source metadata for UI
export const sourceMetadata: Record<SourceType, { name: string; color: string; icon: string }> = {
  wikipedia: { name: 'Wikipedia', color: 'source-wikipedia', icon: 'W' },
  wikidata: { name: 'Wikidata', color: 'source-wikipedia', icon: 'WD' },
  github: { name: 'GitHub', color: 'source-github', icon: 'GH' },
  hackernews: { name: 'Hacker News', color: 'source-hackernews', icon: 'HN' },
  reddit: { name: 'Reddit', color: 'source-reddit', icon: 'R' },
  stackoverflow: { name: 'Stack Overflow', color: 'source-stackoverflow', icon: 'SO' },
  arxiv: { name: 'arXiv', color: 'source-arxiv', icon: 'arX' },
  pubmed: { name: 'PubMed', color: 'source-arxiv', icon: 'PM' },
  cve: { name: 'CVE', color: 'source-cve', icon: 'CVE' },
  whois: { name: 'WHOIS', color: 'source-whois', icon: 'WH' },
  dns: { name: 'DNS', color: 'source-whois', icon: 'DNS' },
  company: { name: 'Companies', color: 'source-company', icon: 'CO' },
  sec: { name: 'SEC', color: 'source-company', icon: 'SEC' },
  archive: { name: 'Archive.org', color: 'source-archive', icon: 'IA' },
  devto: { name: 'Dev.to', color: 'source-devto', icon: 'DEV' },
  lobsters: { name: 'Lobsters', color: 'source-hackernews', icon: 'L' },
  npm: { name: 'npm', color: 'source-npm', icon: 'npm' },
  pypi: { name: 'PyPI', color: 'source-pypi', icon: 'Py' },
  news: { name: 'News', color: 'source-news', icon: 'N' },
  duckduckgo: { name: 'DuckDuckGo', color: 'source-news', icon: 'DDG' },
}
