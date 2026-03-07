/**
 * 国際化（i18n）モジュール
 *
 * - expo-localization でデバイスのロケールを取得して初期言語を決定する
 * - Zustand で言語状態を管理し、Settings画面からの切り替えに対応する
 * - 言語設定は AsyncStorage に永続化する
 * - t(key, params?) 関数はReact外でも利用できるピュア関数
 * - useTranslation() フックはコンポーネント内で使用し、言語変化で再レンダリングされる
 */
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import ja, { TranslationKey } from './translations/ja';
import en from './translations/en';

export type Language = 'ja' | 'en';
export type TranslationParams = Record<string, string | number>;

const STORAGE_KEY = '@i18n/language';

const translations: Record<Language, typeof ja> = { ja, en };

/** デバイスのロケールから初期言語を判定 */
function detectLanguage(): Language {
  const locales = getLocales();
  const langCode = locales[0]?.languageCode ?? 'ja';
  return langCode === 'ja' ? 'ja' : 'en';
}

type I18nStore = {
  language: Language;
  isHydrated: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  hydrate: () => Promise<void>;
};

export const useI18nStore = create<I18nStore>((set, get) => ({
  language: detectLanguage(),
  isHydrated: false,

  setLanguage: async (language: Language) => {
    set({ language });
    await AsyncStorage.setItem(STORAGE_KEY, language);
  },

  hydrate: async () => {
    if (get().isHydrated) return;
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved === 'ja' || saved === 'en') {
      set({ language: saved, isHydrated: true });
    } else {
      set({ isHydrated: true });
    }
  },
}));

/**
 * 翻訳文字列を返す（React外でも使用可能）。
 * `{key}` プレースホルダーを params で置換する。
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const lang = useI18nStore.getState().language;
  const dict = translations[lang] as Record<string, string>;
  let str = dict[key] ?? (translations.ja as Record<string, string>)[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}

/**
 * コンポーネント内で使用する翻訳フック。
 * 言語が変わると自動的に再レンダリングされる。
 */
export function useTranslation() {
  const language = useI18nStore((state) => state.language);
  const setLanguage = useI18nStore((state) => state.setLanguage);
  const dict = translations[language] as Record<string, string>;

  const translate = (key: TranslationKey, params?: TranslationParams): string => {
    let str = dict[key] ?? (translations.ja as Record<string, string>)[key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replaceAll(`{${k}}`, String(v));
      }
    }
    return str;
  };

  return { t: translate, language, setLanguage };
}
