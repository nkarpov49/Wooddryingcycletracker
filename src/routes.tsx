import React from "react";
import { createBrowserRouter, Outlet } from "react-router";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LanguageProvider } from "./utils/i18n";
import { Toaster } from "sonner@2.0.3";
import LoginScreen from "./components/roles/LoginScreen";
import OperatorView from "./components/roles/OperatorView";
import PackerViewNew from "./components/roles/PackerViewNew";
import CycleList from "./components/CycleList";
import CycleForm from "./components/CycleForm";
import CycleDetail from "./components/CycleDetail";
import AdminLayout from "./components/AdminLayout";

function Root() {
  return (
    <LanguageProvider>
      <AuthProvider>
         <Outlet />
         <Toaster position="bottom-center" />
      </AuthProvider>
    </LanguageProvider>
  );
}

function MainRoute() {
    const { role } = useAuth();
    
    if (!role) return <LoginScreen />;
    if (role === 'operator') return <OperatorView />;
    if (role === 'packer') return <PackerViewNew />;
    
    // Admin
    return (
        <AdminLayout>
            <CycleList />
        </AdminLayout>
    );
}

function AdminRoute({ Component }: { Component: React.ComponentType }) {
    const { role } = useAuth();
    
    if (!role) return <LoginScreen />;
    if (role === 'operator') return <OperatorView />; // Or redirect?
    if (role === 'packer') return <PackerViewNew />;
    
    return (
        <AdminLayout>
            <Component />
        </AdminLayout>
    );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: MainRoute },
      { path: "new", Component: () => <AdminRoute Component={CycleForm} /> },
      { path: "cycle/:id", Component: () => <AdminRoute Component={CycleDetail} /> },
      { path: "edit/:id", Component: () => <AdminRoute Component={CycleForm} /> },
      { path: "*", Component: MainRoute } // Fallback
    ],
  },
]);