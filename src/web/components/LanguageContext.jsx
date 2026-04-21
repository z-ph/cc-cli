import React, { createContext, useContext, useState } from 'react';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    // 从 localStorage 读取，默认中文
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zcc-language') || 'zh';
    }
    return 'zh';
  });

  const toggleLanguage = () => {
    const newLang = language === 'zh' ? 'en' : 'zh';
    setLanguage(newLang);
    localStorage.setItem('zcc-language', newLang);
  };

  // 提供当前语言的显示标签
  const languageLabel = language === 'zh' ? 'EN' : '中文';

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, languageLabel }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
