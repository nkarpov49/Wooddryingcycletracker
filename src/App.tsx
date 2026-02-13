import React from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router 

-dom";
import { Home, ArrowLeft, LogOut } from "lucide-react";
import { Toaster } from "sonner";

import CycleList from "./components/ui/CycleList";
import CycleForm from "./components/ui/CycleForm";
import CycleDetail from "./components/ui/CycleDetail";
import ScrollToTop from "./components/ui/ScrollToTop";
import { LanguageProvider, useLanguage } from "./utils/i18n";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginScreen from "./components/roles/LoginScreen";
import OperatorView from "./components/roles/OperatorView";
import PackerView from "./components/roles/PackerView";

// AdminLayout — общий заголовок для админа
function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/admin" || location.pathname === "/admin/";
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
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-gray-600 hover:text-gray-900">
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{t('appTitle') || 'Wood Drying Tracker'}</h1>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={toggleLang}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 font-bold text-sm border border-gray-200 w-10 h-10 flex items-center justify-center"
            >
              {lang.toUpperCase()}
            </button>
            <button
              onClick={() => navigate('/admin')}
              className={`p-2 rounded-full ${isHome ? 'bg-amber-100 text-amber-800' : 'text-gray-500 hover:bg-gray-100'}`}
              title={t('home') || 'Главная'}
            >
              <Home className="w-6 h-6" />
            </button>
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

function AppContent() {
  const { role } = useAuth();

  if (!role) {
    return <LoginScreen />;
  }

  if (role === 'operator') {
    return <OperatorView />;
  }

  if (role === 'packer') {
    return <PackerView />;
  }

  // Администратор — полный интерфейс
  return (
    <AdminLayout>
      <Routes>
        <Route path="/admin" element={<CycleList />} />
        <Route path="/admin/new" element={<CycleForm />} />
        <Route path="/admin/cycle/:id" element={<CycleDetail />} />
        <Route path="/admin/edit/:id" element={<CycleForm />} />
        {/* Добавь другие маршруты админа, если нужно */}
        <Route path="*" element={<CycleList />} /> {/* fallback на список */}
      </Routes>
    </AdminLayout>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
          <Toaster position="bottom-center" />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
