import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { API } from "../config";

interface User {
  id: string;
  email: string;
  display_name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch(`${API}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser({
          id: data.id || data.user_id,
          email: data.email,
          display_name: data.display_name,
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    window.location.hash = "#/";
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
