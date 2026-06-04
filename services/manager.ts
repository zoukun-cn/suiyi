import { TranslationRequest, TranslationResult } from './interface';
import { TranslationServiceRegistry } from './registry';

const STORAGE_KEY = 'activeTranslationService';
const DEFAULT_SERVICE_NAME = 'pass-through';

export class TranslationManager {
  private activeServiceName: string = DEFAULT_SERVICE_NAME;

  constructor(private registry: TranslationServiceRegistry) {
    this.loadActiveService();
  }

  private async loadActiveService(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        this.activeServiceName = result[STORAGE_KEY];
      }
    } catch {
      // 使用默认值
    }
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const service = this.registry.getService(this.activeServiceName) ?? this.registry.getDefault();
    return service.translate(request);
  }

  async setActiveService(name: string): Promise<boolean> {
    const service = this.registry.getService(name);
    if (!service) {
      return false;
    }
    this.activeServiceName = name;
    try {
      await chrome.storage.sync.set({ [STORAGE_KEY]: name });
      return true;
    } catch {
      return false;
    }
  }

  getActiveServiceName(): string {
    return this.activeServiceName;
  }

  listAvailableServices(): string[] {
    return this.registry.getAll().map((s) => s.name);
  }
}
