import './popup.css';
import { Language } from '../services/interface';

let serviceSelect: HTMLSelectElement;
let sourceLangSelect: HTMLSelectElement;
let targetLangSelect: HTMLSelectElement;
let inputText: HTMLTextAreaElement;
let translateBtn: HTMLButtonElement;
let resultSection: HTMLDivElement;
let resultText: HTMLDivElement;
let resultService: HTMLDivElement;
let translatePageBtn: HTMLButtonElement;
let restorePageBtn: HTMLButtonElement;

function init(): void {
  serviceSelect = document.getElementById('service-select') as HTMLSelectElement;
  sourceLangSelect = document.getElementById('source-lang') as HTMLSelectElement;
  targetLangSelect = document.getElementById('target-lang') as HTMLSelectElement;
  inputText = document.getElementById('input-text') as HTMLTextAreaElement;
  translateBtn = document.getElementById('translate-btn') as HTMLButtonElement;
  resultSection = document.getElementById('result-section') as HTMLDivElement;
  resultText = document.getElementById('result-text') as HTMLDivElement;
  resultService = document.getElementById('result-service') as HTMLDivElement;
  translatePageBtn = document.getElementById('translate-page-btn') as HTMLButtonElement;
  restorePageBtn = document.getElementById('restore-page-btn') as HTMLButtonElement;

  populateLanguageSelects();
  loadServices();
  loadSettings();

  translateBtn.addEventListener('click', handleTranslate);
  serviceSelect.addEventListener('change', handleServiceChange);
  sourceLangSelect.addEventListener('change', saveSettings);
  targetLangSelect.addEventListener('change', saveSettings);
  translatePageBtn.addEventListener('click', handleTranslatePage);
  restorePageBtn.addEventListener('click', handleRestorePage);
}

function populateLanguageSelects(): void {
  const options: { value: Language; label: string }[] = [
    { value: Language.AUTO, label: '自动检测' },
    { value: Language.ZH_CN, label: '中文（简体）' },
    { value: Language.ZH_TW, label: '中文（繁体）' },
    { value: Language.EN, label: 'English' },
    { value: Language.JA, label: '日本語' },
    { value: Language.KO, label: '한국어' },
    { value: Language.FR, label: 'Français' },
    { value: Language.DE, label: 'Deutsch' },
    { value: Language.ES, label: 'Español' },
    { value: Language.RU, label: 'Русский' },
  ];

  options.forEach((opt) => {
    const sourceOpt = document.createElement('option');
    sourceOpt.value = opt.value;
    sourceOpt.textContent = opt.label;
    sourceLangSelect.appendChild(sourceOpt);

    const targetOpt = document.createElement('option');
    targetOpt.value = opt.value;
    targetOpt.textContent = opt.label;
    targetLangSelect.appendChild(targetOpt);
  });

  sourceLangSelect.value = Language.AUTO;
  targetLangSelect.value = Language.ZH_CN;
}

async function loadServices(): Promise<void> {
  try {
    const services: string[] = await chrome.runtime.sendMessage({ action: 'list-services' });
    serviceSelect.innerHTML = '';
    services.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      serviceSelect.appendChild(opt);
    });
  } catch {
    // 静默失败
  }
}

async function loadSettings(): Promise<void> {
  try {
    const result = await chrome.storage.sync.get(['activeTranslationService', 'sourceLang', 'targetLang']);
    if (result.activeTranslationService) {
      serviceSelect.value = result.activeTranslationService;
    }
    if (result.sourceLang) {
      sourceLangSelect.value = result.sourceLang;
    }
    if (result.targetLang) {
      targetLangSelect.value = result.targetLang;
    }
  } catch {
    // 使用默认值
  }
}

async function saveSettings(): Promise<void> {
  try {
    await chrome.storage.sync.set({
      sourceLang: sourceLangSelect.value as Language,
      targetLang: targetLangSelect.value as Language,
    });
  } catch {
    // 忽略
  }
}

async function handleServiceChange(): Promise<void> {
  const name = serviceSelect.value;
  try {
    const res = await chrome.runtime.sendMessage({ action: 'set-active-service', serviceName: name });
    if (!res?.success) {
      alert('切换服务失败');
    }
  } catch {
    alert('切换服务失败');
  }
}

async function handleTranslate(): Promise<void> {
  const text = inputText.value.trim();
  if (!text) return;

  translateBtn.disabled = true;
  translateBtn.textContent = '翻译中...';

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'translate',
      request: {
        text,
        sourceLang: sourceLangSelect.value as Language,
        targetLang: targetLangSelect.value as Language,
      },
    });

    if (result) {
      resultText.textContent = result.translatedText;
      resultService.textContent = `由 ${result.serviceName} 提供`;
      resultSection.style.display = 'block';
    }
  } catch {
    resultText.textContent = '翻译失败，请重试';
    resultSection.style.display = 'block';
  } finally {
    translateBtn.disabled = false;
    translateBtn.textContent = '翻译';
  }
}

async function handleTranslatePage(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, { action: 'translate-page' });
      window.close();
    }
  } catch {
    alert('无法翻译当前页面');
  }
}

async function handleRestorePage(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      await chrome.tabs.sendMessage(tab.id, { action: 'restore-page' });
      window.close();
    }
  } catch {
    alert('无法恢复页面');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
