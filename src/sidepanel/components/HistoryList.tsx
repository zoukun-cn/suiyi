import type { HistoryItem } from '../../types'

interface HistoryListProps {
  items: HistoryItem[]
  onSelect: (item: HistoryItem) => void
  onClear: () => void
}

export default function HistoryList({ items, onSelect, onClear }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: 'var(--suiyi-text-secondary)' }}>
        暂无翻译历史
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>翻译历史</h3>
        <button className="suiyi-link-btn" onClick={onClear}>
          清空
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <div
            key={item.id}
            className="suiyi-result-box"
            style={{ cursor: 'pointer', padding: 10 }}
            onClick={() => onSelect(item)}
          >
            <p style={{ fontSize: 13, marginBottom: 4 }}>{item.original.slice(0, 100)}</p>
            <p style={{ fontSize: 13, color: 'var(--suiyi-accent)' }}>{item.translated.slice(0, 100)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
