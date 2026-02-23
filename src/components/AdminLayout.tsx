import React from "react";
import { Link, useLocation } from "react-router";
import { Home, ArrowLeft, LogOut } from "lucide-react";
import { useLanguage } from "../utils/i18n";
import { useAuth } from "../contexts/AuthContext";
import logo from 'figma:asset/32d9f34f23a4ec0005a03e8d2748df656ba8dfab.png';
import ScrollToTop from "./ScrollToTop";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { lang, setLang, t } = useLanguage();
  const { logout } = useAuth();

  const toggleLang = () => {
    setLang(lang === 'ru' ? 'lt' : 'ru');
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans text-gray-900">
      <ScrollToTop />
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          {!isHome ? (
            <button onClick={() => window.history.back()} className="p-2 -ml-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
             <div className="flex items-center gap-2">
               <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
               <h1 className="text-xl font-bold text-gray-900">{t('appTitle')}</h1>
             </div>
          )}
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleLang}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 font-bold text-sm border border-gray-200 w-10 h-10 flex items-center justify-center"
            >
              {lang.toUpperCase()}
            </button>
            <Link 
              to="/" 
              className={`p-2 rounded-full ${isHome ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-100'}`}
              title={t('home')}
            >
              <Home className="w-6 h-6" />
            </Link>
            <button
              onClick={logout}
              className="p-2 rounded-full text-red-500 hover:bg-red-50"
              title="Выход"
            >
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  );
}
