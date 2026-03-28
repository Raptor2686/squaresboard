import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Marketplace from "./pages/Marketplace";
import BoardDetail from "./pages/BoardDetail";
import Auth from "./pages/Auth";
import MySquares from "./pages/MySquares";

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api";

function formatCents(c: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);
}

function Nav() {
  const { user, logout } = useAuth();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      fetch(`${API}/wallet/me`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setBalance(d.balance_cents ?? 0))
        .catch(() => setBalance(null));
    }
  }, [user]);

  return (
    <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link to="/" className="text-xl font-bold text-blue-400">SquaresBoard</Link>
        <div className="flex gap-6 text-sm">
          <Link to="/" className="hover:text-blue-400">Marketplace</Link>
          <Link to="/my-squares" className="hover:text-blue-400">My Squares</Link>
        </div>
      </div>
      <div className="flex gap-4 items-center text-sm">
        {user ? (
          <>
            {balance !== null && (
              <span className="text-zinc-400 font-mono">
                {formatCents(balance)}
              </span>
            )}
            <span className="text-zinc-300">Hi, {user.display_name}</span>
            <button
              onClick={logout}
              className="text-zinc-400 hover:text-red-400"
            >
              Sign Out
            </button>
          </>
        ) : (
          <Link to="/auth" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg font-medium">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-zinc-900 text-white">
          <Nav />
          <Routes>
            <Route path="/" element={<Marketplace />} />
            <Route path="/board/:boardId" element={<BoardDetail />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/my-squares" element={<MySquares />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
