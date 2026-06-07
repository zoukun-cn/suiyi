// 后台 Service Worker — 翻译插件的消息中枢
import { translator } from '../services/translator'
import { GoogleTranslateEngine } from '../services/engines/google'
import { DeepLEngine } from '../services/engines/deepl'
import { OpenAITranslateEngine } from '../services/engines/openai'
import type { LanguageCode, EngineType } from '../types'
import { getApiKey, getSettings, saveSettings } from '../services/storage'

export {}

// ==================== 初始化翻译引擎 ====================

// 注册内置引擎
translator.register(new GoogleTranslateEngine())
translator.register(new DeepLEngine())
translator.register(new OpenAITranslateEngine())

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

  console.log('[Suiyi] Initialized with engines:', translator.list().join(', '))
}

initialize()

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

    case 'TRANSLATE_PAGE': {
      handlePageTranslate(message.payload)
        .then((result) => sendResponse({ success: true, data: result }))
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true
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
