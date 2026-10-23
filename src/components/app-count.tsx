import { useEffect, useState } from 'react'
import { fetchAppCatalog } from '@/lib/github-app-catalog'

export interface AppCountProps {
  fallback: number
}

export function AppCount({ fallback }: AppCountProps) {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true

    fetchAppCatalog()
      .then((catalog) => {
        if (active) setCount(catalog.apps.length)
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
