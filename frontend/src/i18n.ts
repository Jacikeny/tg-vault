import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enUtils from "./locales/en.json";
import zhUtils from "./locales/zh.json";

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: enUtils },
            zh: { translation: zhUtils },
        },
        fallbackLng: "en",
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
        }
    });

const syncDocumentLanguage = (language?: string) => {
    document.documentElement.lang = language?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
};
syncDocumentLanguage(i18n.resolvedLanguage || i18n.language);
i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;
