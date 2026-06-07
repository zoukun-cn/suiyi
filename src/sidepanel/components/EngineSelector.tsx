import { ENGINES } from '../../types'
import type { EngineType } from '../../types'

interface EngineSelectorProps {
  active: EngineType
  onChange: (engine: EngineType) => void
}

export default function EngineSelector({ active, onChange }: EngineSelectorProps) {
  return (
    <div>
      <label style={{ fontSize: 13, color: 'var(--suiyi-text-secondary)', marginBottom: 6, display: 'block' }}>
        翻译引擎
      </label>
      <div className="suiyi-engine-selector">
        {ENGINES.map((engine) => (
          <button
            key={engine.type}
            className={`suiyi-engine-chip ${active === engine.type ? 'active' : ''}`}
            onClick={() => engine.enabled && onChange(engine.type)}
            disabled={!engine.enabled}
            title={
              !engine.enabled
                ? '需要配置 API Key (即将支持)'
                : `使用 ${engine.name}`
            }
          >
            {engine.name}
          </button>
        ))}
      </div>
    </div>
  )
}
