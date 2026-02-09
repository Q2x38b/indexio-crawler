export interface FetchResult<T> {
  data: T | null
  error: Error | null
  source: string
  timing: number
}

export interface ParallelFetchOptions {
  timeout?: number
  retries?: number
}

const DEFAULT_TIMEOUT = 3000 // 3 seconds per source

/**
 * Fetch with timeout and error handling
 */
export async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Indexio-Crawler/1.0',
        ...fetchOptions.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json() as T
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Fetch with timeout, returning null on error instead of throwing
 */
export async function safeFetch<T>(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T | null> {
  try {
    return await fetchWithTimeout<T>(url, options)
  } catch {
    return null
  }
}

/**
 * Execute multiple fetches in parallel with individual timeouts
 */
export async function parallelFetch<T>(
  fetchers: Array<{ name: string; fn: () => Promise<T> }>,
  options: ParallelFetchOptions = {}
): Promise<FetchResult<T>[]> {
  const { timeout = DEFAULT_TIMEOUT } = options

  const promises = fetchers.map(async ({ name, fn }) => {
    const start = Date.now()

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), timeout)
      })

      const data = await Promise.race([fn(), timeoutPromise])

      return {
        data,
        error: null,
        source: name,
        timing: Date.now() - start,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
        source: name,
        timing: Date.now() - start,
      }
    }
  })

  return Promise.all(promises)
}

/**
 * Create a URL with query parameters
 */
export function buildUrl(base: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(base)

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private timestamps: number[] = []
  private readonly limit: number
  private readonly window: number

  constructor(limit: number, windowMs: number = 60000) {
    this.limit = limit
    this.window = windowMs
  }

  async acquire(): Promise<boolean> {
    const now = Date.now()
    this.timestamps = this.timestamps.filter(t => now - t < this.window)

    if (this.timestamps.length >= this.limit) {
      return false
    }

    this.timestamps.push(now)
    return true
  }
}
