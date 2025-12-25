"use client";

import React from 'react';
import { useLanguage } from '@/src/contexts/LanguageContext';

const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLanguage('en')}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          language === 'en'
            ? 'bg-white text-blue-600 shadow'
            : 'text-white hover:bg-white/20'
        }`}
        aria-label="Switch to English"
      >
        {t('language.en')}
      </button>
      <button
        onClick={() => setLanguage('tr')}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          language === 'tr'
            ? 'bg-white text-blue-600 shadow'
            : 'text-white hover:bg-white/20'
        }`}
        aria-label="Switch to Turkish"
      >
        {t('language.tr')}
      </button>
    </div>
  );
};

export default LanguageSwitcher;





