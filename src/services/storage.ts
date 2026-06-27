// 存储服务 — 基于 @plasmohq/storage 封装
import { Storage } from '@plasmohq/storage'
import type { UserSettings, HistoryItem, LanguageCode, EngineType, TranslateMode } from '../types'

const storage = new Storage({ area: 'sync' })

// 本地存储 (翻译历史等，不跨设备同步)
const local = new Storage({ area: 'local' })

// ==================== 设置相关 ====================

const SETTINGS_KEY = 'suiyi_settings'

const DEFAULT_SETTINGS: UserSettings = {
  defaultFrom: 'auto',
  defaultTo: 'zh-CN',
  defaultEngine: 'deepseek',
  translateMode: 'bilingual',
  enableHover: true,
  enableSelection: true,
  translationTipStyles: {
    skeleton: true,
    progressBar: true,
  },
  siteConfigs: [
    {
      urlPattern: 'https://github.com/',
      priority: 10,
      skipSelectors: [
        'a[data-skip-target-assigned="false"].js-skip-to-content',
        '[class*="VisuallyHidden"]',
      ],
    },
  ],
}

export async function getSettings(): Promise<UserSettings> {
  const data = await storage.get(SETTINGS_KEY)
  console.log('[Storage] Loaded settings:', data)
  if (data) {
    return { ...DEFAULT_SETTINGS, ...(data as unknown as UserSettings) }
  }
  return DEFAULT_SETTINGS
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await storage.set(SETTINGS_KEY, settings)
}

export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings()
  const next = { ...current, ...partial }
  await saveSettings(next)
  return next
}

// ==================== 翻译历史 ====================

const HISTORY_KEY = 'suiyi_history'
const MAX_HISTORY = 100

export async function getHistory(): Promise<HistoryItem[]> {
  const data = await local.get(HISTORY_KEY)
  return data ? (data as unknown as HistoryItem[]) : []
}

export async function addHistory(item: HistoryItem): Promise<void> {
  const history = await getHistory()
  history.unshift(item)
  // 保留最近 100 条
  if (history.length > MAX_HISTORY) {
    history.length = MAX_HISTORY
  }
  await local.set(HISTORY_KEY, history)
}

export async function clearHistory(): Promise<void> {
  await local.remove(HISTORY_KEY)
}

// ==================== API Key 管理 ====================

const API_KEY_PREFIX = 'suiyi_apikey_'

export async function getApiKey(engine: EngineType): Promise<string | null> {
  return await local.get(`${API_KEY_PREFIX}${engine}`)
}

export async function setApiKey(engine: EngineType, key: string): Promise<void> {
  await local.set(`${API_KEY_PREFIX}${engine}`, key)
}

export async function removeApiKey(engine: EngineType): Promise<void> {
  await local.remove(`${API_KEY_PREFIX}${engine}`)
}
