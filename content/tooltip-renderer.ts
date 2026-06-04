import { TranslationResult } from '../services/interface';

const TOOLTIP_ID = 'translation-tooltip';
let currentTooltip: HTMLElement | null = null;

export function setupTooltipRenderer(): void {
  document.addEventListener('mousedown', (e) => {
    if (currentTooltip && !currentTooltip.contains(e.target as Node)) {
      hideTooltip();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideTooltip();
    }
  });
}

export function showTooltip(
  result: TranslationResult,
  x?: number,
  y?: number
): void {
  hideTooltip();

  const tooltip = document.createElement('div');
  tooltip.id = TOOLTIP_ID;
  tooltip.style.cssText = `
    position: fixed;
    z-index: 999999;
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px 16px;
    max-width: 320px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: #333;
    word-break: break-word;
  `;

  const originalText = document.createElement('div');
  originalText.style.cssText = 'color: #888; font-size: 12px; margin-bottom: 6px;';
  originalText.textContent = result.sourceLang + ': ' + result.translatedText;

  const translatedText = document.createElement('div');
  translatedText.style.cssText = 'color: #222; font-weight: 500;';
  translatedText.textContent = result.translatedText;

  const serviceName = document.createElement('div');
  serviceName.style.cssText = 'color: #bbb; font-size: 11px; margin-top: 8px; text-align: right;';
  serviceName.textContent = result.serviceName;

  tooltip.appendChild(originalText);
  tooltip.appendChild(translatedText);
  tooltip.appendChild(serviceName);

  document.body.appendChild(tooltip);
  currentTooltip = tooltip;

  // 定位
  const rect = tooltip.getBoundingClientRect();
  let left = (x ?? window.innerWidth / 2) - rect.width / 2;
  let top = (y ?? window.innerHeight / 2) - rect.height - 12;

  if (left < 8) left = 8;
  if (left + rect.width > window.innerWidth - 8) {
    left = window.innerWidth - rect.width - 8;
  }
  if (top < 8) {
    top = (y ?? window.innerHeight / 2) + 12;
  }

  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

export function hideTooltip(): void {
  if (currentTooltip) {
    currentTooltip.remove();
    currentTooltip = null;
  }
}
