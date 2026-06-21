// 异常重试工具 — 为不稳定的异步操作（网络请求、API 调用等）提供带退避的重试机制

// ==================== 配置类型 ====================

export interface RetryOptions {
  /** 最大重试次数（不含首次调用），默认 3 */
  maxRetries: number
  /**
   * 可重试判定 — 返回 true 则重试，false 则立即抛出。
   * 默认：所有错误都重试
   */
  shouldRetry?: (error: unknown, attempt: number) => boolean
  /**
   * 重试回调 — 每次重试前调用，用于日志/通知
   */
  onRetry?: (error: unknown, attempt: number) => void
}

// ==================== 默认值 ====================

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {
  maxRetries: 3,
  shouldRetry: () => true,
  onRetry: (err, attempt) => {
    console.warn('[Retry] Attempting retry', { err, attempt })
  },
}): Promise<T> {
  let lastError: unknown
  const { maxRetries, shouldRetry, onRetry } = opts
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      // 已达最大重试次数，不再重试
      if (attempt >= maxRetries) break
      // 检查是否可重试
      if (shouldRetry && !shouldRetry(error, attempt + 1)) {
        throw error
      }

      // 通知回调
      onRetry?.(error, attempt + 1)
    }
  }

  throw lastError
}