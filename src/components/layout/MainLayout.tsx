import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import React, { ReactNode } from 'react';


interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow container mx-auto px-2 sm:px-4 md:px-6 py-4 md:py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
