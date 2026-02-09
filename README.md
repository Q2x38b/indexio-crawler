# Indexio - Ultra Powerful Minimal Search Engine

A blazing-fast, minimal search engine that aggregates data from 20+ free sources with NLP-powered semantic understanding.

## Features

- **20+ Data Sources**: Wikipedia, GitHub, Hacker News, Reddit, Stack Overflow, arXiv, CVE databases, WHOIS, and more
- **NLP-Powered**: Query intent classification and semantic ranking using OpenAI
- **Minimal UI**: Clean, keyboard-first interface with dark mode support
- **Fast**: Edge runtime with parallel fetching and smart caching
- **OSINT Ready**: Domain lookups, CVE searches, company data, and historical archives

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Add your OPENAI_API_KEY (optional but recommended)

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | Enables AI intent classification and semantic ranking |
| `GITHUB_TOKEN` | No | Higher rate limits for GitHub API |
| `NEWSAPI_KEY` | No | News article results |

## Data Sources

### Web & Knowledge
- Wikipedia / Wikidata
- DuckDuckGo Instant Answers
- Archive.org / Wayback Machine

### Developer & Tech
- GitHub (repos and code)
- Stack Overflow
- Hacker News
- Dev.to
- npm / PyPI

### OSINT & Security
- WHOIS / DNS lookups
- CVE Database (NIST NVD)
- OpenCorporates
- SEC EDGAR

### Research
- arXiv (scientific papers)
- PubMed

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` or `Cmd+K` | Focus search |
| `Enter` | Search / Open selected |
| `Esc` | Clear search |
| `j` / `↓` | Next result |
| `k` / `↑` | Previous result |
| `g` | Go to first |
| `G` | Go to last |

## API Endpoints

```
GET /api/search?q=query&categories=all&limit=30
GET /api/intent?q=query
GET /api/sources
GET /api/sources/[source]?q=query
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Runtime**: Vercel Edge Functions
- **NLP**: OpenAI text-embedding-3-small

## Deployment

Deploy to Vercel:

```bash
npm install -g vercel
vercel
```

## License

MIT
