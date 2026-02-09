export type SourceType =
  // Web & Knowledge
  | 'wikipedia'
  | 'wikidata'
  | 'duckduckgo'
  | 'googlecse'
  | 'archive'
  // Code & Development
  | 'github'
  | 'stackoverflow'
  | 'devto'
  | 'lobsters'
  | 'npm'
  | 'pypi'
  // News & Social
  | 'hackernews'
  | 'reddit'
  | 'news'
  // OSINT & Security
  | 'whois'
  | 'dns'
  | 'cve'
  | 'company'
  | 'sec'
  | 'username'
  | 'ipgeo'
  // Research & Academic
  | 'arxiv'
  | 'pubmed'
  | 'crossref'
  | 'worldbank'
  | 'who'
  | 'census'

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
  type: 'general' | 'person' | 'company' | 'domain' | 'tech' | 'security' | 'research' | 'ip' | 'username' | 'doi'
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
  web: ['googlecse', 'wikipedia', 'wikidata', 'duckduckgo', 'archive'],
  code: ['github', 'stackoverflow', 'devto', 'npm', 'pypi', 'lobsters'],
  osint: ['whois', 'dns', 'cve', 'company', 'sec', 'username', 'ipgeo', 'archive'],
  research: ['arxiv', 'pubmed', 'crossref', 'worldbank', 'who', 'census', 'wikipedia', 'wikidata'],
  news: ['hackernews', 'reddit', 'news', 'devto', 'lobsters'],
  all: [],
}

// Source metadata for UI
export const sourceMetadata: Record<SourceType, { name: string; color: string; icon: string }> = {
  // Web & Knowledge
  wikipedia: { name: 'Wikipedia', color: 'bg-gray-100 text-gray-800', icon: 'W' },
  wikidata: { name: 'Wikidata', color: 'bg-green-100 text-green-800', icon: 'WD' },
  duckduckgo: { name: 'DuckDuckGo', color: 'bg-orange-100 text-orange-800', icon: 'DDG' },
  googlecse: { name: 'Google', color: 'bg-blue-100 text-blue-800', icon: 'G' },
  archive: { name: 'Archive.org', color: 'bg-amber-100 text-amber-800', icon: 'IA' },
  // Code & Development
  github: { name: 'GitHub', color: 'bg-slate-100 text-slate-800', icon: 'GH' },
  stackoverflow: { name: 'Stack Overflow', color: 'bg-orange-100 text-orange-800', icon: 'SO' },
  devto: { name: 'Dev.to', color: 'bg-indigo-100 text-indigo-800', icon: 'DEV' },
  lobsters: { name: 'Lobsters', color: 'bg-red-100 text-red-800', icon: 'L' },
  npm: { name: 'npm', color: 'bg-red-100 text-red-800', icon: 'npm' },
  pypi: { name: 'PyPI', color: 'bg-blue-100 text-blue-800', icon: 'Py' },
  // News & Social
  hackernews: { name: 'Hacker News', color: 'bg-orange-100 text-orange-800', icon: 'HN' },
  reddit: { name: 'Reddit', color: 'bg-orange-100 text-orange-800', icon: 'R' },
  news: { name: 'News', color: 'bg-purple-100 text-purple-800', icon: 'N' },
  // OSINT & Security
  whois: { name: 'WHOIS', color: 'bg-cyan-100 text-cyan-800', icon: 'WH' },
  dns: { name: 'DNS', color: 'bg-cyan-100 text-cyan-800', icon: 'DNS' },
  cve: { name: 'CVE', color: 'bg-red-100 text-red-800', icon: 'CVE' },
  company: { name: 'Companies', color: 'bg-emerald-100 text-emerald-800', icon: 'CO' },
  sec: { name: 'SEC', color: 'bg-blue-100 text-blue-800', icon: 'SEC' },
  username: { name: 'Username', color: 'bg-violet-100 text-violet-800', icon: '@' },
  ipgeo: { name: 'IP Lookup', color: 'bg-teal-100 text-teal-800', icon: 'IP' },
  // Research & Academic
  arxiv: { name: 'arXiv', color: 'bg-red-100 text-red-800', icon: 'arX' },
  pubmed: { name: 'PubMed', color: 'bg-blue-100 text-blue-800', icon: 'PM' },
  crossref: { name: 'CrossRef', color: 'bg-orange-100 text-orange-800', icon: 'CR' },
  worldbank: { name: 'World Bank', color: 'bg-blue-100 text-blue-800', icon: 'WB' },
  who: { name: 'WHO', color: 'bg-blue-100 text-blue-800', icon: 'WHO' },
  census: { name: 'US Census', color: 'bg-blue-100 text-blue-800', icon: 'US' },
}

// Intent to sources mapping for smart routing
export const intentSourceMap: Record<QueryIntent['type'], SourceType[]> = {
  general: ['googlecse', 'wikipedia', 'duckduckgo', 'hackernews', 'reddit'],
  person: ['wikipedia', 'wikidata', 'username', 'github', 'hackernews', 'reddit'],
  company: ['company', 'sec', 'wikipedia', 'wikidata', 'googlecse', 'news'],
  domain: ['whois', 'dns', 'cve', 'archive', 'googlecse'],
  tech: ['github', 'stackoverflow', 'npm', 'pypi', 'devto', 'hackernews'],
  security: ['cve', 'whois', 'dns', 'ipgeo', 'github'],
  research: ['arxiv', 'pubmed', 'crossref', 'worldbank', 'who', 'census', 'wikipedia'],
  ip: ['ipgeo', 'whois', 'dns'],
  username: ['username', 'github', 'reddit', 'hackernews'],
  doi: ['crossref', 'arxiv', 'pubmed'],
}
