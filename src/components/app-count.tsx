import { useEffect, useState } from 'react'
import { fetchInstallableAppFolders } from '@/lib/github-app-catalog'

export interface AppCountProps {
  fallback: number
}

export function AppCount({ fallback }: AppCountProps) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    fetchInstallableAppFolders()
      .then((folders) => {
        if (active) setCount(folders.length)
      })
      .catch(() => {
        if (active) setCount(fallback)
      })

    return () => {
      active = false
    }
  }, [fallback])

  return <div className="metric-value" aria-label={count === null ? 'Loading app count' : `${count} apps`}>{count ?? '…'}</div>
}
