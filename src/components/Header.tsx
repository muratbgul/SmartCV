"use client";

import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '@/src/contexts/LanguageContext';

const Header = () => {
  const { t } = useLanguage();

  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-700 py-3 md:py-4 text-white shadow-lg">
      <div className="container mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="font-bold text-lg sm:text-xl md:text-2xl text-center flex-1">
            <span className="block sm:inline">{t('header.title')}</span>
            <span className="hidden sm:inline"> – </span>
            <span className="block sm:inline text-sm sm:text-base md:text-xl">{t('header.subtitle')}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
