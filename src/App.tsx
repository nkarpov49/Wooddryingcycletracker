import React from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { Home, ArrowLeft, LogOut } from "lucide-react";
import { Toaster } from "sonner";
import CycleList from "./components/ui/CycleList.tsx";
import CycleForm from "./components/ui/CycleForm.tsx";
import CycleDetail from "./components/ui/CycleDetail.tsx";
import ScrollToTop from "./components/ui/ScrollToTop.tsx";
import { LanguageProvider, useLanguage } from "./utils/i18n";
import { AuthProvider, useAuth } from "./contexts/AuthContext.tsx";
import LoginScreen from "./components/roles/LoginScreen.tsx";
import OperatorView from "./components/roles/OperatorView.tsx";
import PackerView from "./components/roles/PackerView.tsx";

// AdminLayout — общий заголовок для всех страниц админа
function AdminLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname.startsWith("/admin");
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

  return (
    <Routes>
      {/* Оператор */}
      <Route path="/operator/*" element={<OperatorView />} />

      {/* Упаковщик */}
      <Route path="/packer/*" element={<PackerView />} />

      {/* Администратор */}
      <Route path="/admin/*" element={
        <AdminLayout>
          <Routes>
            <Route index element={<CycleList />} /> {/* /admin — список */}
            <Route path="new" element={<CycleForm />} />
            <Route path="cycle/:id" element={<CycleDetail />} />
            <Route path="edit/:id" element={<CycleForm />} />
            <Route path="*" element={<CycleList />} /> {/* fallback */}
          </Routes>
        </AdminLayout>
      } />

      {/* Fallback на логин */}
      <Route path="*" element={<LoginScreen />} />
    </Routes>
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
