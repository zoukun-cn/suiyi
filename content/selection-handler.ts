import { Language } from '../services/interface';
import { showTooltip } from './tooltip-renderer';

export function setupSelectionHandler(): void {
  document.addEventListener('mouseup', handleMouseUp);
}

function handleMouseUp(event: MouseEvent): void {
  const selection = window.getSelection();
  const text = selection?.toString().trim();

  if (!text) return;

  const request = {
    text,
    sourceLang: Language.AUTO,
    targetLang: Language.ZH_CN,
  };

  chrome.runtime
    .sendMessage({ action: 'translate', request })
    .then((result) => {
      if (result) {
        showTooltip(result, event.clientX, event.clientY);
      }
    })
    .catch(() => {
      // 静默失败
    });
}
