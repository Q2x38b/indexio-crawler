import type { SearchResult, SourceAdapter } from './types'
import { fetchWithTimeout } from '@/lib/utils/fetcher'
import { generateId, truncate } from '@/lib/utils'

// Common social platforms to check
const PLATFORMS = [
  { name: 'GitHub', url: 'https://github.com/', checkUrl: 'https://api.github.com/users/', icon: 'GH', color: 'source-github' },
  { name: 'Twitter/X', url: 'https://twitter.com/', icon: 'X', color: 'source-twitter' },
  { name: 'Instagram', url: 'https://instagram.com/', icon: 'IG', color: 'source-instagram' },
  { name: 'LinkedIn', url: 'https://linkedin.com/in/', icon: 'LI', color: 'source-linkedin' },
  { name: 'Reddit', url: 'https://reddit.com/user/', checkUrl: 'https://www.reddit.com/user/{}/about.json', icon: 'R', color: 'source-reddit' },
  { name: 'YouTube', url: 'https://youtube.com/@', icon: 'YT', color: 'source-youtube' },
  { name: 'TikTok', url: 'https://tiktok.com/@', icon: 'TT', color: 'source-tiktok' },
  { name: 'Medium', url: 'https://medium.com/@', icon: 'M', color: 'source-medium' },
  { name: 'Dev.to', url: 'https://dev.to/', icon: 'DEV', color: 'source-devto' },
  { name: 'Mastodon', url: 'https://mastodon.social/@', icon: 'MS', color: 'source-mastodon' },
  { name: 'Keybase', url: 'https://keybase.io/', checkUrl: 'https://keybase.io/_/api/1.0/user/lookup.json?usernames={}', icon: 'KB', color: 'source-keybase' },
  { name: 'HackerNews', url: 'https://news.ycombinator.com/user?id=', checkUrl: 'https://hacker-news.firebaseio.com/v0/user/{}.json', icon: 'HN', color: 'source-hackernews' },
  { name: 'GitLab', url: 'https://gitlab.com/', icon: 'GL', color: 'source-gitlab' },
  { name: 'Dribbble', url: 'https://dribbble.com/', icon: 'DR', color: 'source-dribbble' },
  { name: 'Behance', url: 'https://behance.net/', icon: 'BE', color: 'source-behance' },
  { name: 'Pinterest', url: 'https://pinterest.com/', icon: 'PI', color: 'source-pinterest' },
  { name: 'Twitch', url: 'https://twitch.tv/', icon: 'TW', color: 'source-twitch' },
  { name: 'Spotify', url: 'https://open.spotify.com/user/', icon: 'SP', color: 'source-spotify' },
  { name: 'SoundCloud', url: 'https://soundcloud.com/', icon: 'SC', color: 'source-soundcloud' },
  { name: 'Flickr', url: 'https://flickr.com/people/', icon: 'FL', color: 'source-flickr' },
]

export const usernameAdapter: SourceAdapter = {
  config: {
    name: 'Username Search',
    source: 'username',
    category: 'osint',
    enabled: true,
    timeout: 10000,
  },

  async search(query: string, limit = 20): Promise<SearchResult[]> {
    // Clean the username
    const username = query.replace(/^@/, '').trim()

    if (!username || username.includes(' ') || username.length < 2) {
      return []
    }

    const results: SearchResult[] = []
    const checkPromises: Promise<SearchResult | null>[] = []

    // Check platforms with APIs first
    for (const platform of PLATFORMS.slice(0, limit)) {
      checkPromises.push(checkPlatform(username, platform))
    }

    const checked = await Promise.allSettled(checkPromises)

    for (const result of checked) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }

    // Add unchecked platforms as potential matches
    const checkedNames = results.map(r => r.metadata?.platform)
    for (const platform of PLATFORMS) {
      if (!checkedNames.includes(platform.name) && results.length < limit) {
        results.push({
          id: generateId(),
          title: `${platform.name}: @${username}`,
          description: `Potential profile on ${platform.name}. Click to check if this account exists.`,
          url: `${platform.url}${username}`,
          source: 'username' as const,
          category: 'osint' as const,
          score: 0.5,
          metadata: {
            platform: platform.name,
            username,
            verified: false,
          },
          favicon: `https://www.google.com/s2/favicons?domain=${new URL(platform.url).hostname}&sz=32`,
        })
      }
    }

    return results.slice(0, limit)
  },
}

async function checkPlatform(
  username: string,
  platform: { name: string; url: string; checkUrl?: string; icon: string }
): Promise<SearchResult | null> {
  try {
    if (platform.checkUrl) {
      const checkUrl = platform.checkUrl.replace('{}', username)

      if (platform.name === 'GitHub') {
        const data = await fetchWithTimeout<{ login: string; name: string; bio: string; public_repos: number; followers: number }>(
          checkUrl + username,
          { timeout: 3000 }
        )
        if (data.login) {
          return {
            id: generateId(),
            title: `GitHub: ${data.name || data.login}`,
            description: truncate(
              [
                data.bio || 'GitHub user',
                `${data.public_repos} repos`,
                `${data.followers} followers`,
              ].filter(Boolean).join(' | '),
              200
            ),
            url: `${platform.url}${username}`,
            source: 'username' as const,
            category: 'osint' as const,
            score: 0.95,
            metadata: {
              platform: platform.name,
              username: data.login,
              verified: true,
              repos: data.public_repos,
              followers: data.followers,
            },
            favicon: 'https://github.com/favicon.ico',
          }
        }
      }

      if (platform.name === 'HackerNews') {
        const data = await fetchWithTimeout<{ id: string; karma: number; about?: string; created: number }>(
          checkUrl,
          { timeout: 3000 }
        )
        if (data.id) {
          return {
            id: generateId(),
            title: `HackerNews: ${data.id}`,
            description: `Karma: ${data.karma} | ${data.about ? truncate(data.about.replace(/<[^>]*>/g, ''), 150) : 'HackerNews user'}`,
            url: `${platform.url}${username}`,
            source: 'username' as const,
            category: 'osint' as const,
            score: 0.9,
            metadata: {
              platform: platform.name,
              username: data.id,
              verified: true,
              karma: data.karma,
            },
            favicon: 'https://news.ycombinator.com/favicon.ico',
          }
        }
      }

      if (platform.name === 'Reddit') {
        const data = await fetchWithTimeout<{ data: { name: string; total_karma: number; created_utc: number } }>(
          checkUrl.replace('{}', username),
          { timeout: 3000 }
        )
        if (data.data?.name) {
          return {
            id: generateId(),
            title: `Reddit: u/${data.data.name}`,
            description: `Karma: ${data.data.total_karma} | Account created: ${new Date(data.data.created_utc * 1000).toLocaleDateString()}`,
            url: `${platform.url}${username}`,
            source: 'username' as const,
            category: 'osint' as const,
            score: 0.9,
            metadata: {
              platform: platform.name,
              username: data.data.name,
              verified: true,
              karma: data.data.total_karma,
            },
            favicon: 'https://www.reddit.com/favicon.ico',
          }
        }
      }
    }
  } catch {
    // Platform check failed, return null
  }

  return null
}

// Email to username correlation
export function extractPotentialUsernames(email: string): string[] {
  const localPart = email.split('@')[0]
  if (!localPart) return []

  const usernames: string[] = [localPart]

  // Common email patterns
  // firstname.lastname -> firstname, lastname, firstnamelastname
  if (localPart.includes('.')) {
    const parts = localPart.split('.')
    usernames.push(...parts)
    usernames.push(parts.join(''))
  }

  // firstname_lastname
  if (localPart.includes('_')) {
    const parts = localPart.split('_')
    usernames.push(...parts)
    usernames.push(parts.join(''))
  }

  // Remove numbers at end (john.doe123 -> john.doe)
  const withoutNumbers = localPart.replace(/\d+$/, '')
  if (withoutNumbers && withoutNumbers !== localPart) {
    usernames.push(withoutNumbers)
  }

  return [...new Set(usernames)]
}
