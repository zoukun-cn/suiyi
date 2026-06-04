import { TranslationManager } from '../services/manager';
import { Language } from '../services/interface';

const CONTEXT_MENU_ID = 'translate-selection';

export function setupContextMenu(manager: TranslationManager): void {
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: '翻译选中文本',
      contexts: ['selection'],
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== CONTEXT_MENU_ID) return;
    if (!info.selectionText || !tab?.id) return;

    const request = {
      text: info.selectionText,
      sourceLang: Language.AUTO,
      targetLang: Language.ZH_CN,
    };

    manager.translate(request).then((result) => {
      chrome.tabs.sendMessage(tab.id!, {
        action: 'show-tooltip',
        result,
      });
    });
  });
}
