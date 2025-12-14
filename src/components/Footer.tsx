"use client";

import { useLanguage } from '@/src/contexts/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-gradient-to-r from-blue-600 to-purple-700 py-3 sm:py-4 text-white text-center mt-6 sm:mt-8">
      <div className="container mx-auto px-4">
        <p className="text-xs sm:text-sm text-gray-200">{t('footer.copyright')}</p>
      </div>
    </footer>
  );
};

export default Footer;
