import { useState, useEffect } from 'react'
import { Github, Star, GitFork } from 'lucide-react'

interface GitHubRepoData {
  name: string
  full_name: string
  stargazers_count: number
  forks_count: number
  description: string
}

interface GitHubRepoBadgeProps {
  repo: string // format: "owner/repo"
}

/**
 * GitHub Repository Badge Component
 * Displays repository info with stars and forks count
 */
export function GitHubRepoBadge({ repo }: GitHubRepoBadgeProps) {
  const [repoData, setRepoData] = useState<GitHubRepoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const fetchRepoData = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}`)
        if (response.ok) {
          const data = await response.json()
          setRepoData(data)
        } else {
          setError(true)
        }
      } catch (err) {
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchRepoData()
  }, [repo])

  if (loading) {
    return (
      <a
        href={`https://github.com/${repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-2 text-card-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <Github className="h-4 w-4" />
        <span className="text-sm font-medium">GitHub</span>
      </a>
    )
  }

  if (error || !repoData) {
    return (
      <a
        href={`https://github.com/${repo}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-card px-3 py-2 text-card-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <Github className="h-4 w-4" />
        <span className="text-sm font-medium">GitHub</span>
      </a>
    )
  }

  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-3 rounded-md border border-border/80 bg-card px-3 py-2 text-card-foreground transition-colors hover:border-primary/50 hover:text-primary"
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
