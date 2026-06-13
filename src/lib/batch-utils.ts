
/**
 * 将列表按批次拆分
 *
 * @example
 * partition([1,2,3,4,5], 2) → [[1,2], [3,4], [5]]
 */
export function partition<T>(list: T[], batchSize: number): Array<Array<T>> {
  if (batchSize <= 0) return [list]
  const result: T[][] = []
  for (let i = 0; i < list.length; i += batchSize) {
    result.push(list.slice(i, i + batchSize))
  }
  return result
}
