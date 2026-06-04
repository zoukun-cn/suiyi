export enum Language {
  AUTO = 'auto',
  ZH_CN = 'zh-CN',
  ZH_TW = 'zh-TW',
  EN = 'en',
  JA = 'ja',
  KO = 'ko',
  FR = 'fr',
  DE = 'de',
  ES = 'es',
  RU = 'ru',
}

export interface TranslationRequest {
  text: string;
  sourceLang: Language;
  targetLang: Language;
}

export interface TranslationResult {
  translatedText: string;
  sourceLang: Language;
  targetLang: Language;
  serviceName: string;
}

export interface ITranslationService {
  readonly name: string;
  translate(request: TranslationRequest): Promise<TranslationResult>;
}
