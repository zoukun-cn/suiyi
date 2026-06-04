import { ITranslationService, TranslationRequest, TranslationResult } from './interface';

export class PassThroughService implements ITranslationService {
  readonly name = 'pass-through';

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      translatedText: request.text,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      serviceName: this.name,
    };
  }
}
