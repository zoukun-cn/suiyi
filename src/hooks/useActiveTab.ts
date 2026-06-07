// 当前标签页 Hook
import { useState, useEffect } from 'react'
import { getActiveTab } from '../lib/messaging'

export function useActiveTab() {
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getActiveTab()
      .then((t) => {
        setTab(t)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return { tab, loading, error }
}
