// 存储 Hook — 封装 plasmo storage 的 React 用法
import { useState, useEffect, useCallback } from 'react'
import { Storage } from '@plasmohq/storage'

const storage = new Storage({ area: 'sync' })

/**
 * 同步扩展存储到 React State 的 Hook
 */
export function useStorageState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue)
  const [loaded, setLoaded] = useState(false)

  // 加载初始值
  useEffect(() => {
    storage.get<T>(key).then((stored) => {
      if (stored !== undefined) {
        setValue(stored)
      }
      setLoaded(true)
    })
  }, [key])

  // 监听存储变化 (跨上下文同步)
  useEffect(() => {
    const handleChange = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes[key]) {
        setValue(changes[key].newValue ?? defaultValue)
      }
    }

    chrome.storage.onChanged.addListener(handleChange)
    return () => chrome.storage.onChanged.removeListener(handleChange)
  }, [key, defaultValue])

  // 更新值并持久化
  const update = useCallback(
    async (newValue: T | ((prev: T) => T)) => {
      const resolved = typeof newValue === 'function'
        ? (newValue as (prev: T) => T)(value)
        : newValue
      setValue(resolved)
      await storage.set(key, resolved)
    },
    [key, value]
  )

  return { value, update, loaded } as const
}
