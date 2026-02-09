// Environment configuration
export const config = {
  // API Keys (from environment variables)
  openaiApiKey: process.env.OPENAI_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
  newsApiKey: process.env.NEWSAPI_KEY,

  // Search defaults
  defaultTimeout: 3000,
  defaultLimit: 30,
  cacheTTL: 5 * 60 * 1000, // 5 minutes

  // Feature flags
  features: {
    useAIIntent: !!process.env.OPENAI_API_KEY,
    useEmbeddings: !!process.env.OPENAI_API_KEY,
    enhancedGitHub: !!process.env.GITHUB_TOKEN,
  },

  // Rate limiting
  rateLimits: {
    github: 60, // requests per hour (unauthenticated)
    githubAuth: 5000, // requests per hour (authenticated)
    stackoverflow: 300, // requests per day
    nvd: 50, // requests per 30 seconds with API key
  },
} as const

export type Config = typeof config
