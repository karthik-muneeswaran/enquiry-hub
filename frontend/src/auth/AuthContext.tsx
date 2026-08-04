import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATIC_USERS, type StaticUser, type Permission, type UserRole } from './users';

const AUTH_STORAGE_KEY = 'auth_user';

export interface AuthContextType {
  user: StaticUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getStoredUser(): StaticUser | null {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as StaticUser;
    // Validate against static users to ensure data integrity
    const match = STATIC_USERS.find((u) => u.id === parsed.id);
    return match ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaticUser | null>(getStoredUser);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  const login = useCallback((email: string, password: string): boolean => {
    const found = STATIC_USERS.find(
      (u) => u.email === email.toLowerCase() && u.password === password,
    );
    if (found) {
      setUser(found);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    navigate('/login');
  }, [navigate]);

  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user],
  );

  const hasRole = useCallback(
    (role: UserRole): boolean => {
      if (!user) return false;
      return user.role === role;
    },
    [user],
  );

  const value: AuthContextType = {
    user,
    isAuthenticated: user !== null,
    login,
    logout,
    hasPermission,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
