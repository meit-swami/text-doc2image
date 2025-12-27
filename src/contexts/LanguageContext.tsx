import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, getTranslation, translations } from '@/lib/i18n';
import { getSetting, saveSetting } from '@/lib/storage';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadLanguage = async () => {
      const savedLang = await getSetting('language');
      if (savedLang && ['en', 'hi', 'hinglish'].includes(savedLang)) {
        setLanguageState(savedLang as Language);
      }
      setIsLoaded(true);
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await saveSetting('language', lang);
  };

  const t = getTranslation(language);

  if (!isLoaded) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
