import { TranslationServiceRegistry } from '../services/registry';
import { TranslationManager } from '../services/manager';
import { PassThroughService } from '../services/pass-through';
import { setupContextMenu } from './context-menu';
import { setupMessageHandler } from './message-handler';

function init(): void {
  const registry = new TranslationServiceRegistry();
  registry.register(new PassThroughService());

  const manager = new TranslationManager(registry);

  setupContextMenu(manager);
  setupMessageHandler(manager);
}

init();
