import { setupSelectionHandler } from './selection-handler';
import { setupTooltipRenderer, showTooltip } from './tooltip-renderer';
import { setupPageTranslator } from './page-translator';

setupSelectionHandler();
setupTooltipRenderer();
setupPageTranslator();

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'show-tooltip') {
    showTooltip(message.result);
  }
  if (message.action === 'translate-page') {
    import('./page-translator').then(({ translatePage }) => translatePage());
  }
  if (message.action === 'restore-page') {
    import('./page-translator').then(({ restorePage }) => restorePage());
  }
});
