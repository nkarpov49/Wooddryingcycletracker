import React, { createContext, useContext, useState, useEffect } from 'react';

type UserRole = 'operator' | 'packer' | 'admin' | 'driver' | null;

interface AuthContextType {
  role: UserRole;
  login: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem('wood_app_role') as UserRole) || null;
  });

  const login = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole) {
      localStorage.setItem('wood_app_role', newRole);
    } else {
      localStorage.removeItem('wood_app_role');
    }
  };

  const logout = () => {
    setRole(null);
    localStorage.removeItem('wood_app_role');
  };

  return (
    <AuthContext.Provider value={{ role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}