import { useState, useEffect } from 'react'
import { Github, Star, GitFork } from 'lucide-react'

interface GitHubRepoData {
  full_name: string
  stargazers_count: number
  forks_count: number
}

interface GitHubRepoBadgeProps {
  repo: string
}

interface CachedGitHubRepoData {
  data: GitHubRepoData
  fetchedAt: number
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function getCacheKey(repo: string) {
  return `badger:github-repo:v1:${repo}`
}

function readCachedRepoData(repo: string): CachedGitHubRepoData | null {
  try {
    const cached = localStorage.getItem(getCacheKey(repo))
    if (!cached) return null

    const parsed = JSON.parse(cached) as CachedGitHubRepoData
    if (
      typeof parsed.fetchedAt !== 'number' ||
      typeof parsed.data?.full_name !== 'string' ||
      typeof parsed.data?.stargazers_count !== 'number' ||
      typeof parsed.data?.forks_count !== 'number'
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

function writeCachedRepoData(repo: string, data: GitHubRepoData) {
  try {
    localStorage.setItem(getCacheKey(repo), JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch {
    return
  }
}

export function GitHubRepoBadge({ repo }: GitHubRepoBadgeProps) {
  const [repoData, setRepoData] = useState<GitHubRepoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const cached = readCachedRepoData(repo)

    if (cached) {
      setRepoData(cached.data)
      setLoading(false)
    }

    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return
    }

    const fetchRepoData = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}`)
        if (response.ok) {
          const data = await response.json() as GitHubRepoData
          writeCachedRepoData(repo, data)
          if (!cancelled) setRepoData(data)
        } else if (!cached && !cancelled) {
          setError(true)
        }
      } catch {
        if (!cached && !cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchRepoData()

    return () => {
      cancelled = true
    }
  }, [repo])

  if (loading) {
    return (
      <a
        href={`https://github.com/${repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-[3.25rem] w-[10.75rem] items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-2 text-card-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <Github className="h-4 w-4" />
        <span className="truncate text-sm font-medium">{repo}</span>
      </a>
    )
  }

  if (error || !repoData) {
    return (
      <a
        href={`https://github.com/${repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-[3.25rem] w-[10.75rem] items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-2 text-card-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <Github className="h-4 w-4" />
        <span className="truncate text-sm font-medium">{repo}</span>
      </a>
    )
  }

  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-[3.25rem] w-[10.75rem] items-center gap-3 rounded-md border border-border/80 bg-card px-3 py-2 text-card-foreground transition-colors hover:border-primary/50 hover:text-primary"
    >
      <Github className="h-5 w-5" />
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold truncate">{repoData.full_name}</span>
        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Star className="h-3 w-3" />
            <span>{repoData.stargazers_count.toLocaleString()}</span>
          </div>
          <div className="flex items-center space-x-1">
            <GitFork className="h-3 w-3" />
            <span>{repoData.forks_count.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </a>
  )
}
