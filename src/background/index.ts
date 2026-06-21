// 后台 Service Worker — 翻译插件的消息中枢
import { translator } from '../services/translator'
import { GoogleTranslateEngine } from '../services/engines/google'
import { DeepLEngine } from '../services/engines/deepl'
import { OpenAITranslateEngine } from '../services/engines/openai'
import { DeepSeekEngine } from '../services/engines/deepseek'
import type { LanguageCode, EngineType } from '../types'
import { getApiKey, getSettings, saveSettings } from '../services/storage'
import { retry } from '../lib/retry-utils'

export {}

// 点击扩展图标直接打开侧边栏（无需 popup）
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

// ==================== 初始化翻译引擎 ====================

// 注册内置引擎
translator.register(new GoogleTranslateEngine())
translator.register(new DeepLEngine())
translator.register(new OpenAITranslateEngine())
translator.register(new DeepSeekEngine())

// 异步初始化: 加载 API Keys 和用户设置
async function initialize() {
  const settings = await getSettings()
  translator.setDefault(settings.defaultEngine)

  // 为需要 API Key 的引擎配置密钥
  const deeplKey = await getApiKey('deepl')
  if (deeplKey) {
    const engine = translator.get('deepl') as DeepLEngine
    engine?.setApiKey(deeplKey)
  }

  const openaiKey = await getApiKey('openai')
  if (openaiKey) {
    const engine = translator.get('openai') as OpenAITranslateEngine
    engine?.setApiKey(openaiKey)
  }

  const deepseekKey = await getApiKey('deepseek')
  if (deepseekKey) {
    const engine = translator.get('deepseek') as DeepSeekEngine
    engine?.setApiKey(deepseekKey)
  }

  console.log('[Suiyi] Initialized with engines:', translator.list().join(', '))
}

initialize()

// ==================== 右键菜单 ====================

const MENU_TRANSLATE = 'suiyi-translate-page'
const MENU_RESTORE = 'suiyi-restore-page'
const tabTranslationState = new Map<number, boolean>() // tabId → translated

/** 从 manifest 获取 page-translator content script 的实际文件名（含 hash） */
function getContentScriptFile(): string | null {
  const manifest = chrome.runtime.getManifest()
  for (const cs of manifest.content_scripts || []) {
    for (const js of cs.js || []) {
      if (js.startsWith('page-translator')) return js
    }
  }
  return null
}

// 创建右键菜单
chrome.contextMenus.create({
  id: MENU_TRANSLATE,
  title: '🌐 翻译网页',
  contexts: ['page'],
})

chrome.contextMenus.create({
  id: MENU_RESTORE,
  title: '🔄 还原网页',
  contexts: ['page'],
  visible: false,
})

// 右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) {
    console.error('[Suiyi BG] Context menu click without tab id')
    return
  }

  if (info.menuItemId === MENU_TRANSLATE) {
    getSettings().then(async (settings) => {
      const payload = {
        from: settings.defaultFrom,
        to: settings.defaultTo,
        engine: settings.defaultEngine,
      }
      console.log(`[Suiyi BG] Sending EXECUTE_PAGE_TRANSLATE to tab ${tab.id}:`, payload)

      try {
        const res = await chrome.tabs.sendMessage(tab.id!, {
          type: 'EXECUTE_PAGE_TRANSLATE',
          payload,
        })
        console.log('[Suiyi BG] Content script response:', res)
      } catch {
        // content script 未注入（页面在扩展加载前打开），手动注入
        console.log('[Suiyi BG] Content script not loaded, injecting...')
        try {
          const file = getContentScriptFile()
          if (file) {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id! },
              files: [file],
            })
            const res = await chrome.tabs.sendMessage(tab.id!, {
              type: 'EXECUTE_PAGE_TRANSLATE',
              payload,
            })
            console.log('[Suiyi BG] Content script response (after inject):', res)
          } else {
            console.error('[Suiyi BG] Could not find page-translator in manifest')
          }
        } catch (err2) {
          console.error('[Suiyi BG] Injection failed:', err2)
        }
      }
    })
  }

  if (info.menuItemId === MENU_RESTORE) {
    console.log(`[Suiyi BG] Sending RESTORE_PAGE to tab ${tab.id}`)
    chrome.tabs.sendMessage(tab.id!, { type: 'RESTORE_PAGE' }).then((res) => {
      console.log('[Suiyi BG] RESTORE response:', res)
    }).catch((err) => {
      console.error('[Suiyi BG] Failed to send RESTORE_PAGE:', err)
    })
  }
})

// 切换 Tab 时同步右键菜单状态
chrome.tabs.onActivated.addListener(({ tabId }) => {
  const isTranslated = tabTranslationState.get(tabId) ?? false
  chrome.contextMenus.update(MENU_TRANSLATE, { visible: !isTranslated })
  chrome.contextMenus.update(MENU_RESTORE, { visible: isTranslated })
})

// Tab 关闭时清理状态
chrome.tabs.onRemoved.addListener((tabId) => {
  tabTranslationState.delete(tabId)
})

// ==================== 监听 Storage 变更 ====================

// 当用户在设置页面修改 API Key 时，自动同步到引擎实例
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return

  const PREFIX = 'suiyi_apikey_'
  for (const [key, change] of Object.entries(changes)) {
    if (!key.startsWith(PREFIX)) continue

    const engineType = key.slice(PREFIX.length) as EngineType
    const engine = translator.get(engineType)
    if (!engine || !('setApiKey' in engine)) continue

    const newKey = change.newValue as string | undefined
    if (newKey) {
      ;(engine as { setApiKey: (k: string) => void }).setApiKey(newKey)
      console.log(`[Suiyi] API key synced for ${engineType}`)
    }
  }
})

// ==================== 消息监听 ====================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[Suiyi BG] Received message:", message, _sender);
  switch (message.type) {
    case 'TRANSLATE_TEXT': {
      handleTranslateRequest(message.payload)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true
    }

    case 'BATCH_TRANSLATE_TEXT': {
      handleBatchTranslateRequest(message.payload)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true
    }

    case 'TRANSLATE_PAGE': {
      handlePageTranslate(message.payload)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true
    }

    case 'PAGE_TRANSLATION_STATUS': {
      const { status } = message.payload as { status: 'translated' | 'restored' }
      const tabId = _sender.tab?.id
      if (tabId != null) {
        if (status === 'translated') {
          tabTranslationState.set(tabId, true)
          chrome.contextMenus.update(MENU_TRANSLATE, { visible: false })
          chrome.contextMenus.update(MENU_RESTORE, { visible: true })
        } else {
          tabTranslationState.set(tabId, false)
          chrome.contextMenus.update(MENU_TRANSLATE, { visible: true })
          chrome.contextMenus.update(MENU_RESTORE, { visible: false })
        }
      }
      sendResponse({ success: true })
      return false
    }

    case 'GET_SETTINGS': {
      getSettings()
        .then((settings) => sendResponse({ success: true, data: settings }))
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true
    }

    case 'SAVE_SETTINGS': {
      const { defaultEngine, ...rest } = message.payload
      saveSettings(message.payload)
        .then(() => {
          // 同步更新默认引擎
          if (defaultEngine) {
            try { translator.setDefault(defaultEngine) } catch { /* 引擎未注册 */ }
          }
          sendResponse({ success: true })
        })
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true
    }

    default:
      sendResponse({ success: false, error: `Unknown message type: ${message.type}` })
      return false
  }
})

// ==================== 翻译处理 ====================

interface TranslatePayload {
  text: string
  from: string
  to: string
  engine?: string
}

async function handleTranslateRequest(payload: TranslatePayload) {
  const { text, from, to, engine } = payload

  console.log(`[Suiyi BG] Translating: "${text.slice(0, 50)}..." ${from}→${to} via ${engine || 'default'}`)

  const result = await translator.translate(
    text,
    from as LanguageCode,
    to as LanguageCode,
    engine as EngineType | undefined
  )

  return result
}

interface BatchTranslatePayload {
  texts: string[]
  from: string
  to: string
  engine?: string
}

async function handleBatchTranslateRequest(payload: BatchTranslatePayload) {
  const { texts, from, to, engine } = payload

  console.log(`[Suiyi BG] Batch translating ${texts.length} texts: ${from}→${to} via ${engine || 'default'}`)

  const eng = translator.get((engine as EngineType) || undefined)
  if (!eng) throw new Error(`Engine "${engine}" not registered`)

  const map = await retry(() => eng.batchTranslate(texts, from as LanguageCode, to as LanguageCode))
  return Object.fromEntries(map)
}

async function handlePageTranslate(payload: TranslatePayload) {
  // 页面翻译：将请求广播到当前活跃 Tab 的 content script
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tabs[0]?.id) {
    await chrome.tabs.sendMessage(tabs[0].id, {
      type: 'EXECUTE_PAGE_TRANSLATE',
      payload,
    })
  }
  return { status: 'sent' }
}

console.log('[Suiyi] Background service worker started')
