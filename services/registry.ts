import { ITranslationService } from './interface';
import { PassThroughService } from './pass-through';

export class TranslationServiceRegistry {
  private services = new Map<string, ITranslationService>();
  private defaultService: ITranslationService;

  constructor() {
    this.defaultService = new PassThroughService();
    this.register(this.defaultService);
  }

  register(service: ITranslationService): void {
    this.services.set(service.name, service);
  }

  getService(name: string): ITranslationService | undefined {
    return this.services.get(name);
  }

  getAll(): ITranslationService[] {
    return Array.from(this.services.values());
  }

  getDefault(): ITranslationService {
    return this.defaultService;
  }
}
