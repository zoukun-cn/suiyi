// ==================== 核心类型定义 ====================

/** 语言代码 */
export type LanguageCode = 'auto' | 'zh-CN' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'pt' | 'ru' | 'ar' | 'th' | 'vi' | 'it' | 'nl' | 'pl' | 'tr' | 'id'

/** 语言选项 (用于 UI 展示) */
export interface Language {
  code: LanguageCode
  name: string
}

/** 翻译引擎类型 */
export type EngineType = 'google' | 'deepl' | 'openai' | 'microsoft'

/** 引擎选项 */
export interface Engine {
  type: EngineType
  name: string
  enabled: boolean
  needsApiKey: boolean
}

/** 翻译模式 */
export type TranslateMode = 'bilingual' | 'replacement' | 'hover-only'

/** 翻译请求参数 */
export interface TranslateRequest {
  texts: string[]
  from: LanguageCode
  to: LanguageCode
  engine: EngineType
}

/** 翻译结果 */
export interface TranslateResult {
  original: string
  translated: string
  engine: string
  timestamp: number
}

/** 用户设置 */
export interface UserSettings {
  defaultFrom: LanguageCode
  defaultTo: LanguageCode
  defaultEngine: EngineType
  translateMode: TranslateMode
  enableHover: boolean
  enableSelection: boolean
}

/** 翻译历史条目 */
export interface HistoryItem {
  id: string
  original: string
  translated: string
  from: LanguageCode
  to: LanguageCode
  engine: EngineType
  timestamp: number
}

// ==================== 消息类型 ====================

/** 消息类型枚举 */
export type MessageType =
  | 'TRANSLATE_TEXT'
  | 'TRANSLATE_PAGE'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'OPEN_SIDE_PANEL'
  | 'SHOW_TOOLTIP'
  | 'HIDE_TOOLTIP'

/** 基础消息结构 */
export interface Message<T = unknown> {
  type: MessageType
  payload?: T
}

/** 消息响应 */
export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ==================== 常量 ====================

/** 常用语言列表 (可在后续扩展) */
export const LANGUAGES: Language[] = [
  { code: 'auto', name: '自动检测' },
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ar', name: 'العربية' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'it', name: 'Italiano' },
]

/** 支持的引擎列表 */
export const ENGINES: Engine[] = [
  { type: 'google', name: 'Google 翻译', enabled: true, needsApiKey: false },
  { type: 'microsoft', name: '微软翻译', enabled: true, needsApiKey: false },
  { type: 'deepl', name: 'DeepL', enabled: false, needsApiKey: true },
  { type: 'openai', name: 'OpenAI', enabled: false, needsApiKey: true },
]
