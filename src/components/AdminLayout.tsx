import React, { useState } from "react";
import { Link, useLocation } from "react-router";
import { Home, ArrowLeft, LogOut, Settings, Lock, TreeDeciduous, ChevronDown } from "lucide-react";
import { useLanguage } from "../utils/i18n";
import { useAuth } from "../contexts/AuthContext";
import logo from 'figma:asset/32d9f34f23a4ec0005a03e8d2748df656ba8dfab.png';
import ScrollToTop from "./ScrollToTop";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const isSettings = location.pathname === "/wood-type-settings";
  const isPasswordSettings = location.pathname === "/password-settings";
  const { lang, setLang, t } = useLanguage();
  const { logout } = useAuth();
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

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
            
            {/* Settings Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSettingsMenuOpen(!settingsMenuOpen)}
                className={`p-2 rounded-full flex items-center gap-1 ${
                  isSettings || isPasswordSettings 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
                title={lang === 'ru' ? 'Настройки' : 'Nustatymai'}
              >
                <Settings className="w-6 h-6" />
                <ChevronDown className={`w-4 h-4 transition-transform ${settingsMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {settingsMenuOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setSettingsMenuOpen(false)}
                  />
                  
                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-20">
                    <Link
                      to="/wood-type-settings"
                      onClick={() => setSettingsMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                        isSettings ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <TreeDeciduous className="w-5 h-5" />
                      <div>
                        <div className="font-medium">
                          {lang === 'ru' ? 'Породы дерева' : 'Medienos rūšys'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {lang === 'ru' ? 'Лимиты и время' : 'Limitai ir laikas'}
                        </div>
                      </div>
                    </Link>
                    
                    <Link
                      to="/password-settings"
                      onClick={() => setSettingsMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 ${
                        isPasswordSettings ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                      }`}
                    >
                      <Lock className="w-5 h-5" />
                      <div>
                        <div className="font-medium">
                          {lang === 'ru' ? 'Пароли' : 'Slaptažodžiai'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {lang === 'ru' ? 'Управление доступом' : 'Prieigos valdymas'}
                        </div>
                      </div>
                    </Link>
                  </div>
                </>
              )}
            </div>
            
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