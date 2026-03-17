import React from "react";
import { createBrowserRouter, Outlet } from "react-router";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LanguageProvider } from "./utils/i18n";
import { Toaster } from "sonner@2.0.3";
import LoginScreen from "./components/roles/LoginScreen";
import OperatorView from "./components/roles/OperatorView";
import PackerViewNew from "./components/roles/PackerViewNew";
import DriverView from "./components/roles/DriverView";
import CycleList from "./components/CycleList";
import CycleForm from "./components/CycleForm";
import CycleDetail from "./components/CycleDetail";
import AdminLayout from "./components/AdminLayout";
import WoodTypeSettings from "./components/WoodTypeSettings";
import PasswordSettings from "./components/PasswordSettings";
import TelegramSettings from "./components/TelegramSettings";

function RootLayout() {
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
    if (role === 'driver') return <DriverView />;
    
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
    if (role === 'operator') return <OperatorView />;
    if (role === 'packer') return <PackerViewNew />;
    if (role === 'driver') return <DriverView />;
    
    return (
        <AdminLayout>
            <Component />
        </AdminLayout>
    );
}

// Create wrapper components for each admin route
function NewCycleRoute() {
    return <AdminRoute Component={CycleForm} />;
}

function CycleDetailRoute() {
    return <AdminRoute Component={CycleDetail} />;
}

function EditCycleRoute() {
    return <AdminRoute Component={CycleForm} />;
}

function WoodTypeSettingsRoute() {
    return <AdminRoute Component={WoodTypeSettings} />;
}

function PasswordSettingsRoute() {
    return <AdminRoute Component={PasswordSettings} />;
}

function TelegramSettingsRoute() {
    return <AdminRoute Component={TelegramSettings} />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: MainRoute },
      { path: "new", Component: NewCycleRoute },
      { path: "cycle/:id", Component: CycleDetailRoute },
      { path: "edit/:id", Component: EditCycleRoute },
      { path: "wood-type-settings", Component: WoodTypeSettingsRoute },
      { path: "password-settings", Component: PasswordSettingsRoute },
      { path: "telegram-settings", Component: TelegramSettingsRoute },
      { path: "*", Component: MainRoute } // Fallback
    ],
  },
]);