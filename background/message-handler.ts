import { TranslationManager } from '../services/manager';
import { Language, TranslationRequest } from '../services/interface';

interface TranslateMessage {
  action: 'translate';
  request: TranslationRequest;
}

interface ListServicesMessage {
  action: 'list-services';
}

interface SetActiveServiceMessage {
  action: 'set-active-service';
  serviceName: string;
}

type ExtensionMessage = TranslateMessage | ListServicesMessage | SetActiveServiceMessage;

export function setupMessageHandler(manager: TranslationManager): void {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.action === 'translate') {
      manager
        .translate(message.request)
        .then(sendResponse)
        .catch(() =>
          sendResponse({
            translatedText: message.request.text,
            sourceLang: message.request.sourceLang,
            targetLang: message.request.targetLang,
            serviceName: manager.getActiveServiceName(),
          })
        );
      return true;
    }

    if (message.action === 'list-services') {
      sendResponse(manager.listAvailableServices());
      return false;
    }

    if (message.action === 'set-active-service') {
      manager
        .setActiveService(message.serviceName)
        .then((success) => sendResponse({ success }))
        .catch(() => sendResponse({ success: false }));
      return true;
    }

    return false;
  });
}
