import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

// AdminLayout — заголовок для админа
function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans text-gray-900">
      <ScrollToTop />
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center">
          <h1 className="text-xl font-bold text-gray-900">{t('appTitle') || 'Wood Drying Tracker'}</h1>
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
      <Route path="/operator/*" element={<OperatorView />} />
      <Route path="/packer/*" element={<PackerView />} />

      {/* Администратор */}
      <Route path="/admin/*" element={
        <AdminLayout>
          <Routes>
            <Route index element={<CycleList />} />
            <Route path="new" element={<CycleForm />} />
            <Route path="cycle/:id" element={<CycleDetail />} />
            <Route path="edit/:id" element={<CycleForm />} />
            <Route path="*" element={<CycleList />} />
          </Routes>
        </AdminLayout>
      } />

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
