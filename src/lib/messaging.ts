// 消息通信工具 — 类型安全的 chrome.runtime.sendMessage 封装
import type { Message, MessageResponse, MessageType } from '../types'

/**
 * 发送消息并等待异步响应
 */
export function sendMessage<T = unknown>(
  type: MessageType,
  payload?: unknown
): Promise<MessageResponse<T>> {
  return new Promise((resolve, reject) => {
    const message: Message = { type, payload }
    console.log("[Suiyi] Sending message:", message)
    chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(response)
    })
  })
}

/**
 * 向指定 Tab 发送消息
 */
export function sendMessageToTab<T = unknown>(
  tabId: number,
  type: MessageType,
  payload?: unknown
): Promise<MessageResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type, payload } as Message, (response: MessageResponse<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(response)
    })
  })
}

/**
 * 获取当前活跃 Tab
 */
export function getActiveTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(tabs[0])
    })
  })
}

/**
 * 添加消息监听器 (类型安全封装)
 */
export function addMessageListener(
  handler: (message: Message, sender: chrome.runtime.MessageSender) => Promise<unknown> | unknown
): () => void {
  const listener = (
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ) => {
    const result = handler(message, sender)

    if (result instanceof Promise) {
      result
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true // 保持通道开放
    }

    sendResponse({ success: true, data: result })
    return false
  }

  chrome.runtime.onMessage.addListener(listener)

  return () => {
    chrome.runtime.onMessage.removeListener(listener)
  }
}
